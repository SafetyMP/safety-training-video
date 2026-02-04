import { NextResponse } from 'next/server';
import { TTS_PROVIDER } from '@/lib/constants';
import { getImageProviderId } from '@/lib/providers/image-providers';
import { isVideoProviderEnabled, getVideoProviderId } from '@/lib/providers/video-providers';
import { getRegulatoryApiStatus } from '@/lib/regulatory-api';

/**
 * Health check endpoint that returns status of all configured providers.
 * Returns 200 if essential services are available, 503 otherwise.
 */
export async function GET() {
  const openaiConfigured = Boolean(process.env.OPENAI_API_KEY?.trim());
  const replicateConfigured = Boolean(process.env.REPLICATE_API_TOKEN?.trim());

  const imageProvider = getImageProviderId();
  const ttsProvider = TTS_PROVIDER;
  const videoProvider = getVideoProviderId();

  // Determine which providers need Replicate
  const imageNeedsReplicate = imageProvider === 'sdxl' || imageProvider === 'flux';
  const ttsNeedsReplicate = ttsProvider === 'kokoro';
  const videoNeedsReplicate = isVideoProviderEnabled();
  const needsReplicate = imageNeedsReplicate || ttsNeedsReplicate || videoNeedsReplicate;

  const replicateOk = needsReplicate ? replicateConfigured : true;
  const redisConfigured = Boolean(
    process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
  );
  const regulatory = getRegulatoryApiStatus();

  // Build detailed provider status
  const providers = {
    image: {
      provider: imageProvider,
      configured: imageNeedsReplicate ? replicateConfigured : openaiConfigured,
      backend: imageNeedsReplicate ? 'replicate' : 'openai',
    },
    tts: {
      provider: ttsProvider,
      configured: ttsProvider === 'edge' ? true : ttsNeedsReplicate ? replicateConfigured : openaiConfigured,
      backend: ttsProvider === 'edge' ? 'microsoft-edge' : ttsNeedsReplicate ? 'replicate' : 'openai',
    },
    video: {
      provider: videoProvider,
      configured: videoProvider === 'off' ? true : replicateConfigured,
      backend: videoProvider === 'off' ? 'disabled' : 'replicate',
    },
    script: {
      provider: 'gpt-4o-mini',
      configured: openaiConfigured,
      backend: 'openai',
    },
  };

  // All essential providers must be configured
  const ok = providers.script.configured && providers.image.configured && providers.tts.configured;

  const body = {
    ok,
    providers,
    // Legacy fields for backward compatibility
    openaiConfigured,
    replicateConfigured: replicateOk,
    redisConfigured: redisConfigured || null,
    regulatoryApi: regulatory.enabled ? { effectiveDate: regulatory.effectiveDate } : null,
    // Warnings for misconfiguration
    warnings: [
      ...(needsReplicate && !replicateConfigured
        ? [`REPLICATE_API_TOKEN required for ${imageProvider}/${ttsProvider}/${videoProvider}`]
        : []),
      ...(!openaiConfigured ? ['OPENAI_API_KEY required for script generation'] : []),
    ].filter(Boolean),
  };

  return NextResponse.json(body, {
    status: ok ? 200 : 503,
  });
}
