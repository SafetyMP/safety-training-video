/**
 * Phase 3: AI-powered fact verification.
 *
 * Extracts factual claims from generated script content and verifies them against
 * the EHS reference library. Returns verification status per claim for UI display.
 *
 * Without RAG (Phase 2), verification uses the static EHS reference. Statistics
 * and unverifiable claims are flagged for manual review.
 */

import { OPENAI_REQUEST_TIMEOUT_MS, OPENAI_SCRIPT_MODEL } from '@/lib/constants';
import { getVerificationContextForTopics } from '@/lib/ehs-reference';
import { openai } from '@/lib/openai-client';
import { withRetry } from '@/lib/retry';
import { withTimeout } from '@/lib/timeout';
import type { FactVerificationResult, ScriptResult, Scene } from '@/lib/types';

const CLAIM_TYPES = ['statistic', 'regulation', 'procedure', 'time_limit', 'other'] as const;
const STATUSES = ['verified', 'needs_review', 'unverified'] as const;

/**
 * Build fact verification prompt with chain-of-thought reasoning.
 * 
 * PROMPT ENGINEERING NOTE:
 * GPT-4o-mini benefits from explicit reasoning steps before classification.
 * The "reasoning" field forces the model to explain its verification logic,
 * which improves accuracy and makes results more auditable.
 */
function buildVerificationPrompt(
  script: ScriptResult,
  ehsContext: string
): string {
  const scenesText = script.scenes
    .map((s: Scene, i: number) => `Scene ${i + 1}: ${(s.narration ?? '').trim()}`)
    .filter(Boolean)
    .join('\n\n');

  return `You are an EHS accuracy reviewer. Your job is to extract factual claims from a safety training script, reason through each one, and verify it against the authoritative reference below.

EHS REFERENCE (authoritative):
${ehsContext}

SCRIPT NARRATIONS:
${scenesText}

TASK - Follow these steps IN ORDER for each claim:

1. EXTRACT: Identify 3-8 factual claims that can be verified (statistics, regulatory citations, procedural steps, time limits). Skip general advice that is too vague.

2. REASON: For each claim, you MUST:
   a) Quote the exact claim from the script
   b) Search the EHS reference for relevant sections
   c) Explain how the claim compares to the reference (matches, contradicts, or cannot be verified)
   d) Then determine the status

3. CLASSIFY: Based on your reasoning, set status:
   - verified: Your reasoning shows the claim aligns with the reference
   - needs_review: Statistics or claims where the reference lacks information to verify. Flag for human review.
   - unverified: Your reasoning shows the claim contradicts the reference. Provide a correction.

4. CONFIDENCE: Set based on how directly the reference supports your reasoning:
   - 0.9+: Reference explicitly states the same thing
   - 0.7-0.9: Reference strongly implies it
   - 0.5-0.7: Reference partially supports it
   - Below 0.5: Weak or indirect support

Return valid JSON with reasoning field:
{
  "claims": [
    {
      "claim": "exact claim text from script",
      "sceneIndex": 0,
      "type": "regulation|statistic|procedure|time_limit|other",
      "reasoning": "The claim states X. The EHS reference section Y says Z. This matches/contradicts because...",
      "status": "verified|needs_review|unverified",
      "confidence": 0.9,
      "source": "OSHA 1910.178 if applicable",
      "correction": "required if unverified - what the correct information is"
    }
  ]
}`;
}

/**
 * Extract factual claims from script and verify against EHS reference.
 * Returns verification results for UI display. Does not throw; returns empty array on failure.
 */
export async function verifyScriptFacts(
  script: ScriptResult,
  topicIds: string[]
): Promise<FactVerificationResult[]> {
  if (!script?.scenes?.length || topicIds.length === 0) {
    return [];
  }

  const ehsContext = getVerificationContextForTopics(topicIds);
  if (!ehsContext) return [];

  const prompt = buildVerificationPrompt(script, ehsContext);

  try {
    const completion = await withTimeout(
      withRetry(() =>
        openai.chat.completions.create({
          model: OPENAI_SCRIPT_MODEL,
          messages: [
            {
              role: 'system',
              content: 'You extract and verify factual claims from safety training scripts. Output valid JSON only, no markdown.',
            },
            { role: 'user', content: prompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2,
          max_tokens: 1024,
        })
      ),
      Math.min(OPENAI_REQUEST_TIMEOUT_MS, 30_000),
      'Fact verification timed out'
    );

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return [];

    const parsed = JSON.parse(raw) as { claims?: unknown[] };
    const claims = parsed?.claims;
    if (!Array.isArray(claims)) return [];

    const results: FactVerificationResult[] = [];
    for (const c of claims) {
      if (
        typeof c === 'object' &&
        c !== null &&
        typeof (c as { claim?: unknown }).claim === 'string' &&
        typeof (c as { sceneIndex?: unknown }).sceneIndex === 'number' &&
        CLAIM_TYPES.includes((c as { type?: string }).type as (typeof CLAIM_TYPES)[number]) &&
        STATUSES.includes((c as { status?: string }).status as (typeof STATUSES)[number])
      ) {
        const item = c as {
          claim: string;
          sceneIndex: number;
          type: FactVerificationResult['type'];
          status: FactVerificationResult['status'];
          confidence?: number;
          reasoning?: string;
          source?: string;
          correction?: string;
        };
        const conf = item.confidence;
        results.push({
          claim: item.claim,
          sceneIndex: Math.max(0, Math.min(item.sceneIndex, script.scenes.length - 1)),
          type: item.type,
          status: item.status,
          confidence: typeof conf === 'number' && conf >= 0 && conf <= 1 ? conf : 0.5,
          reasoning: typeof item.reasoning === 'string' ? item.reasoning : undefined,
          source: typeof item.source === 'string' ? item.source : undefined,
          correction: typeof item.correction === 'string' ? item.correction : undefined,
        });
      }
    }
    return results;
  } catch {
    return [];
  }
}
