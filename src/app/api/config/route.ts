import { NextResponse } from 'next/server';
import { IMAGE_PROVIDER, TTS_PROVIDER } from '@/lib/constants';
import { isVideoProviderEnabled } from '@/lib/providers/video-providers';
import { getRegulatoryApiStatus } from '@/lib/regulatory-api';

/**
 * Returns client-side provider config for cost estimation and scene generation.
 */
export async function GET(): Promise<NextResponse> {
  const videoProvider = isVideoProviderEnabled() ? 'wan' : 'off';
  const regulatory = getRegulatoryApiStatus();
  return NextResponse.json({
    videoProvider,
    imageProvider: process.env.IMAGE_PROVIDER ?? process.env.NEXT_PUBLIC_IMAGE_PROVIDER ?? IMAGE_PROVIDER,
    ttsProvider: process.env.TTS_PROVIDER ?? process.env.NEXT_PUBLIC_TTS_PROVIDER ?? TTS_PROVIDER,
    regulatoryApi: regulatory.enabled
      ? { effectiveDate: regulatory.effectiveDate }
      : null,
  });
}
