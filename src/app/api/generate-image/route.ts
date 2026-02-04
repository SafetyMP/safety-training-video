/**
 * Image generation endpoint for safety training scenes.
 * 
 * PROMPT ARCHITECTURE:
 * 1. Script generation (generate-script) creates base imagePrompts
 * 2. This route builds a core prompt with scene context and action emphasis
 * 3. Two-stage refinement (prompt-refinement.ts) optimizes for each provider
 * 4. Providers apply minimal additional formatting
 * 
 * The refinement layer handles all model-specific optimization:
 * - Style positioning (start for SDXL, end for Flux)
 * - Prompt format (keywords vs natural language)
 * - Anatomy instructions
 * - Negative prompt generation (SDXL)
 * 
 * Supports: dall-e-3, gpt-image-1-mini, sdxl, flux
 * Enable/disable refinement via PROMPT_REFINEMENT_ENABLED env (default: true)
 */

import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-errors';
import { refinePromptForProvider } from '@/lib/prompt-refinement';
import { wrapProviderError } from '@/lib/provider-errors';
import { getImageProvider, getImageProviderId } from '@/lib/providers/image-providers';
import { generateImageBodySchema, formatValidationErrors } from '@/lib/schemas';
import { withApiHandler } from '@/lib/with-api-handler';

/**
 * Extract the core action from a prompt.
 * Looks for action verbs and their objects to emphasize.
 */
function extractAction(prompt: string): string | null {
  // Common action patterns in safety prompts - prioritize hand/finger interactions
  const actionPatterns = [
    /\b(finger|hand|hands)\s+(pressing|touching|pushing|pulling|gripping|holding|reaching)[^,.]*/i,
    /\b(pressing|pushing|pulling|clicking|touching)\s+(?:a\s+|the\s+)?(?:\w+\s+)?(button|lever|switch|control|buckle)/i,
    /\b(pressing|pushing|pulling|holding|checking|inspecting|looking|turning|reaching|pointing|wearing|lifting|carrying|operating|using|grabbing|gripping)\b[^,.]*(?:button|lever|handle|horn|switch|control|equipment|tool|gear|ppe|helmet|vest|goggles|gloves)?/i,
    /\b(sit(?:ting)?|stand(?:ing)?|walk(?:ing)?|driv(?:ing|e)?|operat(?:ing|e)?)\b[^,.]*/i,
  ];
  
  for (const pattern of actionPatterns) {
    const match = prompt.match(pattern);
    if (match) return match[0].trim();
  }
  return null;
}

/**
 * Check if prompt requests a close-up shot.
 */
function isCloseUp(prompt: string): boolean {
  return /\bclose-?up\b/i.test(prompt);
}

/**
 * Build a core action-focused prompt that will be refined for each provider.
 * 
 * This function assembles the semantic content (scene, action, composition, style).
 * The prompt refinement layer (prompt-refinement.ts) then transforms this into
 * the optimal format for each provider (style position, keyword vs natural language, etc.)
 * 
 * Focus here is on CONTENT not FORMAT - refinement handles formatting.
 */
function buildCorePrompt(
  imagePrompt: string,
  styleGuide: string,
  safetyKeywords: string,
  isFirstScene: boolean
): string {
  const action = extractAction(imagePrompt);
  const closeUp = isCloseUp(imagePrompt);
  
  // Core instruction: be specific about the action
  let actionEmphasis = '';
  if (action) {
    actionEmphasis = `\n\nCRITICAL ACTION: The person MUST be "${action}" - this is the CENTRAL FOCUS. Show hands/body actively performing this exact motion.`;
    
    // Extra emphasis for hand interactions
    if (/button|lever|switch|control|buckle|handle/i.test(action)) {
      actionEmphasis += ` Show the finger/hand making CONTACT with the ${action.match(/button|lever|switch|control|buckle|handle/i)?.[0] || 'control'}.`;
    }
  }

  // Framing guidance
  const framingGuide = closeUp
    ? `\nFRAMING: Close-up shot focused on the action. Hands and object should fill most of the frame.`
    : `\nFRAMING: Medium shot showing person and environment. Action should be clearly visible.`;

  // Core composition requirements (applies to all models)
  // Check if other people are mentioned in the prompt
  const mentionsOtherPeople = /pedestrian|coworker|spotter|partner|two.?person|helper|assistant|team/i.test(imagePrompt);
  const peopleRequirement = mentionsOtherPeople 
    ? '- Include the people mentioned in the prompt (pedestrians, coworkers, etc.)'
    : '- Single person unless multiple explicitly needed';
  
  const coreComposition = `
REQUIREMENTS:
- Show the SPECIFIC ACTION described, not a generic pose
${peopleRequirement}
- No added props (no clipboard, phone, tablet unless specified)`;

  // Safety keywords
  const keywordSection = safetyKeywords
    ? `\nSAFETY FOCUS: Emphasize visually: ${safetyKeywords}.`
    : '';

  // Style (will be repositioned by some providers)
  let styleSection = '';
  if (isFirstScene && styleGuide) {
    styleSection = `\nSTYLE: ${styleGuide}`;
  } else if (styleGuide) {
    styleSection = `\nSTYLE: ${styleGuide} (maintain consistency)`;
  }

  return `SAFETY TRAINING ILLUSTRATION

SCENE: ${imagePrompt}
${actionEmphasis}
${framingGuide}
${coreComposition}
${keywordSection}
${styleSection}`.trim();
}

async function handleGenerateImage(request: Request): Promise<NextResponse> {
  const body = await request.json();
  const parseResult = generateImageBodySchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(formatValidationErrors(parseResult), { status: 400 });
  }
  const { imagePrompt, styleGuide, highQuality, sceneIndex, safetyKeywords, narration } = parseResult.data;
  const styleGuideText = styleGuide?.trim() ?? '';
  const keywordsText = safetyKeywords?.trim() ?? '';
  const isFirstScene = sceneIndex === 0;

  const providerId = getImageProviderId();

  // Build core prompt with scene, action, and composition
  const corePrompt = buildCorePrompt(
    imagePrompt,
    styleGuideText,
    keywordsText,
    isFirstScene
  );

  // Two-stage refinement: Use OpenAI to optimize the prompt for this specific provider
  // This adapts the prompt structure to match each model's optimal format
  const { refinedPrompt, negativePrompt, wasRefined } = await refinePromptForProvider({
    basePrompt: corePrompt,
    narration,
    styleGuide: styleGuideText || undefined,
    providerId,
  });
  
  console.warn(`[generate-image] Scene ${sceneIndex ?? 0}: Provider: ${providerId}, Refined: ${wasRefined}, Action: "${extractAction(imagePrompt) ?? 'none'}"`);

  const provider = getImageProvider();
  try {
    const imageBase64 = await provider.generate({
      prompt: refinedPrompt,
      highQuality: highQuality ?? false,
      styleGuide: styleGuideText || undefined,
      // Pass raw scene description for providers that prefer simpler prompts (e.g., SDXL)
      rawSceneDescription: imagePrompt,
      // Pass negative prompt if refinement provided one (for SDXL)
      negativePrompt,
    });
    return NextResponse.json({ imageBase64 });
  } catch (err) {
    const wrapped = wrapProviderError(err, 'image', true);
    return NextResponse.json(apiError(wrapped.message, { code: 'INTERNAL_ERROR' }), { status: 500 });
  }
}

export const POST = withApiHandler('generate-image', handleGenerateImage);
