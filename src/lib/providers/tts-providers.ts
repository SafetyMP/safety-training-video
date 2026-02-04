/**
 * TTS (Text-to-Speech) provider abstraction.
 * Switch tiers via TTS_PROVIDER env: openai | edge | kokoro
 * 
 * Provider comparison:
 * - openai: Best quality, $0.015-0.03/1k chars, 6 native voices
 * - edge:   Microsoft Edge TTS (free), high quality, extensive voice library
 * - kokoro: Replicate (free tier), expressive, good for narration
 * 
 * Voice mapping:
 * - The app exposes 18 voice options organized by category
 * - Each provider maps these to its native voice names
 * - Extended voices (guy, jenny, etc.) map to closest equivalents on each provider
 * - OpenAI has 6 native voices; extended voices map to closest matches
 */

import { openai } from '@/lib/openai-client';
import { withRetry } from '@/lib/retry';
import { withReplicateThrottle } from '@/lib/replicate-throttle';
import { withTimeout } from '@/lib/timeout';
import { OPENAI_REQUEST_TIMEOUT_MS } from '@/lib/constants';

export type TTSProviderId = 'openai' | 'edge' | 'kokoro';

export interface TTSGenerateParams {
  text: string;
  voice: string;
  draft: boolean;
}

export interface TTSProvider {
  id: TTSProviderId;
  generate(params: TTSGenerateParams): Promise<{ audioBase64: string; contentType: string }>;
}

/** Voice -> Edge TTS voice names (neural voices) */
const VOICE_MAP: Record<string, string> = {
  // OpenAI native voices mapped to Edge TTS equivalents
  onyx: 'en-US-GuyNeural',
  alloy: 'en-US-JennyNeural',
  echo: 'en-US-ChristopherNeural',
  fable: 'en-GB-SoniaNeural',
  nova: 'en-US-NancyNeural',
  shimmer: 'en-US-AriaNeural',
  // Extended Edge TTS voices
  guy: 'en-US-GuyNeural',
  jenny: 'en-US-JennyNeural',
  aria: 'en-US-AriaNeural',
  davis: 'en-US-DavisNeural',
  jane: 'en-US-JaneNeural',
  jason: 'en-US-JasonNeural',
  sara: 'en-US-SaraNeural',
  tony: 'en-US-TonyNeural',
  nancy: 'en-US-NancyNeural',
  andrew: 'en-US-AndrewNeural',
  emma: 'en-GB-SoniaNeural',
  brian: 'en-GB-RyanNeural',
};

/** Map extended voices to OpenAI's 6 native voices */
const OPENAI_VOICE_MAP: Record<string, 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'> = {
  // Native voices
  onyx: 'onyx',
  alloy: 'alloy',
  echo: 'echo',
  fable: 'fable',
  nova: 'nova',
  shimmer: 'shimmer',
  // Extended voices mapped to closest OpenAI equivalent
  guy: 'onyx',      // authoritative male
  jenny: 'alloy',   // professional female
  aria: 'shimmer',  // energetic female
  davis: 'onyx',    // authoritative male
  jane: 'nova',     // friendly female
  jason: 'echo',    // professional male
  sara: 'nova',     // warm female
  tony: 'echo',     // friendly male
  nancy: 'nova',    // warm female
  andrew: 'echo',   // energetic male
  emma: 'fable',    // British professional
  brian: 'onyx',    // British professional
};

/** OpenAI TTS: ~$15–30/1M chars */
async function generateOpenAI(params: TTSGenerateParams): Promise<{
  audioBase64: string;
  contentType: string;
}> {
  const { text, voice, draft } = params;
  const model = draft ? 'tts-1' : 'tts-1-hd';
  const openaiVoice = OPENAI_VOICE_MAP[voice] ?? 'onyx';

  const mp3 = await withTimeout(
    withRetry(() =>
      openai.audio.speech.create({
        model,
        voice: openaiVoice,
        input: text.trim().replace(/\s+/g, ' '),
      })
    ),
    OPENAI_REQUEST_TIMEOUT_MS,
    'Audio generation timed out'
  );

  const buffer = Buffer.from(await mp3.arrayBuffer());
  return {
    audioBase64: buffer.toString('base64'),
    contentType: 'audio/mpeg',
  };
}

/** Edge TTS: free (Microsoft Read Aloud API) */
async function generateEdge(params: TTSGenerateParams): Promise<{
  audioBase64: string;
  contentType: string;
}> {
  const { text, voice } = params;
  const edgeVoice = VOICE_MAP[voice] ?? 'en-US-GuyNeural';

  const edgeTts = await import('edge-tts-node');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const MsEdgeTTS = edgeTts.MsEdgeTTS as any;
  const OUTPUT_FORMAT = edgeTts.OUTPUT_FORMAT;

  const tts = new MsEdgeTTS();
  await tts.setMetadata(edgeVoice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

  const input = text.trim().replace(/\s+/g, ' ');
  const chunks: Buffer[] = [];
  const stream = tts.toStream(input);

  await new Promise<void>((resolve, reject) => {
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', resolve);
    stream.on('error', reject);
  });

  const buffer = Buffer.concat(chunks);
  return {
    audioBase64: buffer.toString('base64'),
    contentType: 'audio/mpeg',
  };
}

/** Voice -> Kokoro voice names (af_bella, am_michael, etc.) */
const KOKORO_VOICE_MAP: Record<string, string> = {
  // OpenAI native voices
  onyx: 'am_michael',
  alloy: 'af_bella',
  echo: 'am_puck',
  fable: 'af_bella',
  nova: 'af_nicole',
  shimmer: 'af_bella',
  // Extended voices mapped to Kokoro equivalents
  guy: 'am_michael',
  jenny: 'af_bella',
  aria: 'af_nicole',
  davis: 'am_michael',
  jane: 'af_bella',
  jason: 'am_puck',
  sara: 'af_nicole',
  tony: 'am_puck',
  nancy: 'af_nicole',
  andrew: 'am_michael',
  emma: 'af_bella',
  brian: 'am_michael',
};

/** Kokoro via Replicate (~$0.00022/run, high quality) */
async function generateKokoro(params: TTSGenerateParams): Promise<{
  audioBase64: string;
  contentType: string;
}> {
  const { text, voice } = params;
  const kokoroVoice = KOKORO_VOICE_MAP[voice] ?? 'af_bella';
  const token = process.env.REPLICATE_API_TOKEN?.trim();
  if (!token) throw new Error('Audio generation service is not configured. Please contact support.');

  const { default: Replicate } = await import('replicate');
  const replicate = new Replicate({ auth: token });

  const output = await withTimeout(
    withRetry(() =>
      withReplicateThrottle(() =>
        replicate.run('jaaari/kokoro-82m:f559560eb822dc509045f3921a1921234918b91739db4bf3daab2169b71c7a13', {
          input: {
            text: text.trim().replace(/\s+/g, ' '),
            voice: kokoroVoice,
          },
        })
      )
    ),
    OPENAI_REQUEST_TIMEOUT_MS,
    'Audio generation timed out'
  );

  const out = Array.isArray(output) ? output[0] : output;
  let url = '';
  if (typeof out === 'string') url = out;
  else if (out && typeof out === 'object') {
    const u = (out as { url?: () => URL }).url?.();
    url = u ? (typeof u === 'string' ? u : (u as URL).href) : '';
  }
  if (!url) throw new Error('No audio generated');

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch audio: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get('content-type') ?? 'audio/wav';

  return {
    audioBase64: buffer.toString('base64'),
    contentType: contentType.startsWith('audio/') ? contentType : 'audio/wav',
  };
}

const PROVIDERS: Record<TTSProviderId, TTSProvider> = {
  openai: {
    id: 'openai',
    generate: generateOpenAI,
  },
  edge: {
    id: 'edge',
    generate: generateEdge,
  },
  kokoro: {
    id: 'kokoro',
    generate: generateKokoro,
  },
};

export function getTTSProvider(): TTSProvider {
  const id = (process.env.TTS_PROVIDER ?? process.env.NEXT_PUBLIC_TTS_PROVIDER ?? 'openai') as TTSProviderId;
  const provider = PROVIDERS[id];
  if (!provider) {
    return PROVIDERS.openai;
  }
  return provider;
}
