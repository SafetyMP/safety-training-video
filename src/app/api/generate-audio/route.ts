import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-errors';
import { wrapProviderError } from '@/lib/provider-errors';
import { getTTSProvider } from '@/lib/providers/tts-providers';
import { generateAudioBodySchema, formatValidationErrors } from '@/lib/schemas';
import { withApiHandler, type ApiHandlerContext } from '@/lib/with-api-handler';

async function handleGenerateAudio(
  request: Request,
  _ctx: ApiHandlerContext
): Promise<NextResponse> {
  const body = await request.json();
  const parseResult = generateAudioBodySchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(formatValidationErrors(parseResult), { status: 400 });
  }
  const { text, voice, draft } = parseResult.data;

  const provider = getTTSProvider();
  try {
    const { audioBase64, contentType } = await provider.generate({
      text,
      voice,
      draft: draft ?? false,
    });
    return NextResponse.json({
      audioBase64,
      contentType,
    });
  } catch (err) {
    const wrapped = wrapProviderError(err, 'audio', true);
    return NextResponse.json(apiError(wrapped.message, { code: 'INTERNAL_ERROR' }), { status: 500 });
  }
}

export const POST = withApiHandler('generate-audio', handleGenerateAudio);
