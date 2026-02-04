/**
 * Video generation endpoint for safety training scenes.
 * 
 * PROMPT ARCHITECTURE:
 * 1. Script generation creates base imagePrompts (static scene descriptions)
 * 2. Two-stage refinement transforms them for video models:
 *    - Adds motion descriptions (critical for video)
 *    - Adds camera language (static shot, medium shot, etc.)
 *    - Adds atmosphere and temporal cues
 * 3. Video provider adds physics grounding
 * 
 * Video prompts need fundamentally different structure than image prompts:
 * Image: Subject + Action + Composition (static)
 * Video: Subject + Scene + Motion + Camera + Atmosphere + Style (temporal)
 * 
 * Enable/disable refinement via PROMPT_REFINEMENT_ENABLED env (default: true)
 */

import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-errors';
import { refinePromptForProvider } from '@/lib/prompt-refinement';
import { wrapProviderError } from '@/lib/provider-errors';
import { getVideoProvider, isVideoProviderEnabled, getVideoProviderId } from '@/lib/providers/video-providers';
import { generateVideoBodySchema, formatValidationErrors } from '@/lib/schemas';
import { withApiHandler } from '@/lib/with-api-handler';

async function handleGenerateVideo(request: Request): Promise<NextResponse> {
  if (!isVideoProviderEnabled()) {
    return NextResponse.json(
      apiError('Video generation is not available. Please use image mode.', {
        code: 'BAD_REQUEST',
      }),
      { status: 400 }
    );
  }

  const body = await request.json();
  const parseResult = generateVideoBodySchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(formatValidationErrors(parseResult), { status: 400 });
  }

  const { prompt, styleGuide, narration, sceneIndex } = parseResult.data;
  const providerId = getVideoProviderId();

  // Two-stage refinement: Use OpenAI to optimize the prompt for the video model
  // Video models need temporal descriptions (motion, camera, atmosphere) that image prompts lack
  const { refinedPrompt, wasRefined } = await refinePromptForProvider({
    basePrompt: prompt,
    narration,
    styleGuide,
    providerId,
  });

  console.warn(`[generate-video] Scene ${sceneIndex ?? 0}: Provider: ${providerId}, Refined: ${wasRefined}`);

  const provider = getVideoProvider();

  try {
    const { videoBase64, durationSeconds } = await provider.generate({
      prompt: refinedPrompt,
      styleGuide,
      narration,
      // Pass flag indicating prompt was already refined (skip internal buildVideoPrompt)
      wasRefined,
    });

    return NextResponse.json({
      videoBase64,
      durationSeconds,
    });
  } catch (err) {
    const wrapped = wrapProviderError(err, 'video', true);
    return NextResponse.json(apiError(wrapped.message, { code: 'INTERNAL_ERROR' }), { status: 500 });
  }
}

export const POST = withApiHandler('generate-video', handleGenerateVideo);
