import { NextResponse } from 'next/server';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { apiError } from '@/lib/api-errors';
import {
  OPENAI_REQUEST_TIMEOUT_MS,
  SCRIPT_MAX_TOKENS,
  OPENAI_SCRIPT_MODEL,
  MAX_SCENES,
  VISUAL_STYLE_PRESETS,
  type VisualStylePreset,
} from '@/lib/constants';
import {
  getContextForPrompt,
  getTopicsForPrompt,
  getCitationsForTopics,
  validateContentAgainstReference,
} from '@/lib/ehs-reference';
import { verifyScriptFacts } from '@/lib/fact-verification';
import { openai } from '@/lib/openai-client';
import { fetchRegulationsForCitations } from '@/lib/regulatory-api';
import { withRetry } from '@/lib/retry';
import { getUnverifiedSignMentions, ALLOWED_SIGNAL_WORDS } from '@/lib/safety-signs-reference';
import {
  generateScriptBodySchema,
  scriptResultSchema,
  formatValidationErrors,
} from '@/lib/schemas';
import { withTimeout } from '@/lib/timeout';
import { withApiHandler, type ApiHandlerContext } from '@/lib/with-api-handler';
import type { FactVerificationResult } from '@/lib/types';

const FACT_VERIFICATION_ENABLED = process.env.FACT_VERIFICATION_ENABLED !== 'false';
const REGULATORY_API_ENABLED = process.env.REGULATORY_API_ENABLED !== 'false';

/** Strict schema for OpenAI structured outputs (all fields required). */
const scriptStructuredSchema = z.object({
  title: z.string(),
  visualStyle: z.string(),
  scenes: z.array(
    z.object({
      narration: z.string(),
      imagePrompt: z.string(),
      duration: z.union([z.number(), z.null()]).optional(),
    })
  ).min(1).max(MAX_SCENES),
});

const ALLOWED_SIGNS_HINT = ALLOWED_SIGNAL_WORDS.slice(0, 12).join(', ') + '.';

/**
 * SCRIPT GENERATION SYSTEM PROMPT
 * 
 * This generates BASE imagePrompts that describe WHAT to show (content/action/scene).
 * These prompts are then processed by:
 * 1. generate-image route: adds action emphasis and composition context
 * 2. prompt-refinement layer: optimizes format for each provider (DALL-E, SDXL, Flux, etc.)
 * 
 * Focus here: semantic scene description with clear actions and visual details.
 * Do NOT include model-specific formatting (keywords, style positions) - refinement handles that.
 */
const SYSTEM_PROMPT_BASE = `You are a safety training video scriptwriter. Output valid JSON only, no markdown.

## OUTPUT FORMAT
{ "title": "string", "visualStyle": "one short sentence", "scenes": [ { "narration": "string", "imagePrompt": "string" } ] }

## CORE PRINCIPLES
1. The imagePrompt must be a VISUAL TRANSLATION of the narration—show exactly what is being said.
2. DEFAULT TO SINGLE PERSON: Most scenes should show only the main character. Add a second person ONLY when the safety concept requires it (two-person lift, spotter for equipment, buddy system). Never add observers, bystanders, trainers, or crowds just for visual interest.

## SCENE STRUCTURE (3-6 scenes)

For EACH scene, follow this process:

### Step 1: Write the narration (1-3 sentences, conversational tone)

### Step 2: Create the imagePrompt as a visual depiction of that narration

WRONG: Generic scene unrelated to narration
RIGHT: Specific visual showing the exact action/concept from narration

Examples:
- Narration: "Before operating the forklift, always check that the horn works."
  imagePrompt: "Close-up of Alex in forklift seat, one hand reaching forward to press a large red horn button on the dashboard, finger touching the button"

- Narration: "Look left, then right, then left again before moving into an aisle."
  imagePrompt: "Alex in forklift driver seat, head and shoulders turned 90 degrees to the left, eyes looking down a warehouse aisle, hands on steering wheel"

- Narration: "If you see a spill, stop and clean it up or report it immediately."
  imagePrompt: "Alex standing next to forklift, pointing down at a yellow liquid puddle on concrete floor, other hand holding a walkie-talkie radio to mouth"

- Narration: "Always wear your seatbelt when operating the forklift."
  imagePrompt: "Close-up of Alex in forklift seat pulling the seatbelt strap across their chest with both hands, clicking it into the buckle"

### Step 3: Self-verify before including each scene
Ask yourself: "If someone only saw this image, would they understand the safety behavior from the narration?"
- If NO: Rewrite the imagePrompt to show the specific action more clearly
- If YES: Include the scene

## IMAGE PROMPT REQUIREMENTS

Make the KEY ACTION visible with CONCRETE details:
- Hand positions: "finger pressing button", "hand gripping lever"
- Framing: Use "close-up" for small objects like buttons or controls
- Body orientation: "head turned 90 degrees left", "torso twisted"
- Specific objects: "red horn button", "yellow seatbelt buckle"
- Character: Include name and specific action/pose in every prompt
- PPE: Character should wear appropriate safety gear (hard hat, safety vest, etc.) when relevant
- People count: End each imagePrompt with either:
  * "single person scene, no other people visible" (DEFAULT - use for most scenes)
  * "two person scene showing [specific interaction]" (ONLY when safety requires it: two-person lift, spotter, buddy system)
  * Never include passive observers, bystanders, trainers watching, or background crowds

## ADDITIONAL RULES

- visualStyle: Brief description with recurring character INCLUDING PPE (e.g., "illustration of Alex, a worker wearing a yellow hard hat and bright orange safety vest")
- Signs: Only include when relevant. Standard types: ${ALLOWED_SIGNS_HINT}`;

function getVisualStylePreferenceLine(preset: VisualStylePreset | undefined): string {
  const effective = (preset ?? 'illustration') as VisualStylePreset;
  const match = VISUAL_STYLE_PRESETS.find((p) => p.value === effective);
  const hint = match?.scriptHint ?? VISUAL_STYLE_PRESETS[0]?.scriptHint ?? 'Professional corporate illustration with realistic human proportions.';
  return ` Visual style preference: ${hint}`;
}

async function buildSystemPrompt(prompt: string): Promise<{ systemPrompt: string; regulatorySources?: string[] }> {
  const ehsContext = getContextForPrompt(prompt);
  let liveContext = '';
  let regulatorySources: string[] = [];

  if (ehsContext && REGULATORY_API_ENABLED) {
    const topicIds = getTopicsForPrompt(prompt).map((t) => t.id);
    const citations = getCitationsForTopics(topicIds);
    if (citations.length > 0) {
      try {
        const { context, snippets } = await fetchRegulationsForCitations(citations);
        if (context) {
          liveContext = '\n\n' + context;
          regulatorySources = snippets.map((s) => `${s.citation} (${s.effectiveDate})`);
        }
      } catch {
        // Fallback to static only
      }
    }
  }

  const fullContext = ehsContext ? ehsContext + liveContext : '';
  const systemPrompt = fullContext
    ? `${SYSTEM_PROMPT_BASE}\n\n${fullContext}`
    : SYSTEM_PROMPT_BASE;
  return {
    systemPrompt,
    ...(regulatorySources.length > 0 && { regulatorySources }),
  };
}

async function handleGenerateScript(
  request: Request,
  _ctx: ApiHandlerContext
): Promise<NextResponse> {
  const body = await request.json();
  const parseResult = generateScriptBodySchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(formatValidationErrors(parseResult), { status: 400 });
  }
  const { prompt, draft, audience, visualStylePreset, safetyKeywords } = parseResult.data;

  const sceneInstruction = draft
    ? 'Create exactly 3 scenes to keep the video short and low-cost.'
    : 'Create 3 to 6 scenes.';
  const audienceLine = audience?.trim()
    ? ` Target audience: ${audience.trim()}. Adjust tone and depth (new hires = clearer basics, refresher = concise reminders).`
    : '';
  const styleLine = getVisualStylePreferenceLine(visualStylePreset);
  const keywordsLine = safetyKeywords?.trim()
    ? ` KEY SAFETY CONCEPTS TO EMPHASIZE: ${safetyKeywords.trim()}. Every imagePrompt MUST visually feature at least one of these concepts prominently. The background, equipment, and actions should directly relate to these safety topics.`
    : '';

  const userContent = `Topic: ${prompt}.${audienceLine}${styleLine}${keywordsLine} ${sceneInstruction} JSON only.`;

  const { systemPrompt, regulatorySources } = await buildSystemPrompt(prompt);

  const useStructuredOutputs = ['gpt-4o-mini', 'gpt-4o', 'gpt-4o-2024-08-06'].some(
    (m) => OPENAI_SCRIPT_MODEL.includes(m)
  );

  let data: z.infer<typeof scriptResultSchema>;
  try {
    const completion = await withTimeout(
      useStructuredOutputs
        ? withRetry(() =>
            openai.beta.chat.completions.parse({
              model: OPENAI_SCRIPT_MODEL,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userContent },
              ],
              response_format: zodResponseFormat(scriptStructuredSchema, 'script'),
              temperature: 0.6,
              max_tokens: SCRIPT_MAX_TOKENS,
            })
          )
        : withRetry(() =>
            openai.chat.completions.create({
              model: OPENAI_SCRIPT_MODEL,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userContent },
              ],
              response_format: { type: 'json_object' },
              temperature: 0.6,
              max_tokens: SCRIPT_MAX_TOKENS,
            })
          ),
      OPENAI_REQUEST_TIMEOUT_MS,
      'Script generation timed out'
    );

    if (useStructuredOutputs) {
      const msg = (completion as { choices?: Array<{ message?: { parsed?: unknown; refusal?: string } }> })?.choices?.[0]?.message;
      if (msg?.refusal) {
        return NextResponse.json(
          apiError(msg.refusal || 'Request was refused', { code: 'INTERNAL_ERROR' }),
          { status: 500 }
        );
      }
      const rawParsed = msg?.parsed;
      if (!rawParsed) {
        return NextResponse.json(
          apiError('No script generated', { code: 'INTERNAL_ERROR' }),
          { status: 500 }
        );
      }
      const scriptResult = scriptResultSchema.safeParse(rawParsed);
      if (!scriptResult.success) {
        console.error('[generate-script] Schema validation failed:', JSON.stringify(scriptResult.error.errors, null, 2));
        console.error('[generate-script] Raw parsed data:', JSON.stringify(rawParsed, null, 2).slice(0, 1000));
        return NextResponse.json(
          apiError('Invalid script format', { code: 'INTERNAL_ERROR' }),
          { status: 500 }
        );
      }
      data = scriptResult.data;
    } else {
      const raw = (completion as { choices?: Array<{ message?: { content?: string } }> })?.choices?.[0]?.message?.content;
      if (!raw) {
        return NextResponse.json(
          apiError('No script generated', { code: 'INTERNAL_ERROR' }),
          { status: 500 }
        );
      }
      let parsedManual: unknown;
      try {
        parsedManual = JSON.parse(raw);
      } catch {
        return NextResponse.json(
          apiError('Invalid script format from model', { code: 'INTERNAL_ERROR' }),
          { status: 500 }
        );
      }
      const scriptResult = scriptResultSchema.safeParse(parsedManual);
      if (!scriptResult.success) {
        console.error('[generate-script] Schema validation failed:', JSON.stringify(scriptResult.error.errors, null, 2));
        console.error('[generate-script] Raw manual parsed:', JSON.stringify(parsedManual, null, 2).slice(0, 1000));
        return NextResponse.json(
          apiError('Invalid script format', { code: 'INTERNAL_ERROR' }),
          { status: 500 }
        );
      }
      data = scriptResult.data;
    }
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : 'Script generation failed';
    return NextResponse.json(apiError(errMsg, { code: 'INTERNAL_ERROR' }), { status: 500 });
  }
  const unverifiedSignMentions: { sceneIndex: number; mentions: string[] }[] = [];
  data.scenes.forEach((scene, i) => {
    const fromPrompt = getUnverifiedSignMentions(scene.imagePrompt);
    const fromNarration = getUnverifiedSignMentions(scene.narration ?? '');
    const mentions = [...new Set([...fromPrompt, ...fromNarration])];
    if (mentions.length > 0) unverifiedSignMentions.push({ sceneIndex: i, mentions });
  });

  const topicIds = getTopicsForPrompt(prompt).map((t) => t.id);
  const combinedContent = data.scenes
    .map((s) => `${s.narration ?? ''} ${s.imagePrompt ?? ''}`)
    .join(' ');
  const ehsValidation = validateContentAgainstReference(combinedContent, {
    topicIds: topicIds.length ? topicIds : undefined,
  });

  const hasEhsFlags =
    ehsValidation.warnings.length > 0 ||
    ehsValidation.mythsFlagged.length > 0 ||
    ehsValidation.terminologySuggestions.length > 0 ||
    ehsValidation.missingRecommendations.length > 0;

  let factVerification: FactVerificationResult[] | undefined;
  if (FACT_VERIFICATION_ENABLED && topicIds.length > 0) {
    try {
      factVerification = await verifyScriptFacts(data, topicIds);
    } catch {
      factVerification = undefined;
    }
  }

  return NextResponse.json({
    ...data,
    ...(unverifiedSignMentions.length > 0 && { unverifiedSignMentions }),
    ...(factVerification && factVerification.length > 0 && { factVerification }),
    ...(regulatorySources && regulatorySources.length > 0 && { regulatorySources }),
    ...(hasEhsFlags && {
      ehsValidation: {
        topicIds: ehsValidation.topicIds,
        warnings: ehsValidation.warnings,
        terminologySuggestions: ehsValidation.terminologySuggestions,
        mythsFlagged: ehsValidation.mythsFlagged,
        missingRecommendations: ehsValidation.missingRecommendations,
      },
    }),
  });
}

export const POST = withApiHandler('generate-script', handleGenerateScript);
