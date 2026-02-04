/**
 * Centralized environment variable validation using Zod.
 * Validates env vars at startup to fail fast on misconfiguration.
 * 
 * Usage:
 *   import { env } from '@/lib/env';
 *   const key = env.OPENAI_API_KEY;
 */

import { z } from 'zod';

const serverSchema = z.object({
  // Required for core functionality
  OPENAI_API_KEY: z.string().min(1).optional(),

  // OpenAI model overrides
  OPENAI_SCRIPT_MODEL: z.string().default('gpt-4o-mini'),
  OPENAI_IMAGE_MODEL: z.string().default('dall-e-3'),

  // Provider selection
  IMAGE_PROVIDER: z
    .enum(['dall-e-3', 'gpt-image-1-mini', 'sdxl', 'flux'])
    .default('dall-e-3'),
  TTS_PROVIDER: z.enum(['openai', 'edge', 'kokoro']).default('openai'),
  VIDEO_PROVIDER: z.enum(['off', 'wan']).default('off'),

  // Replicate (for Tier 2/3)
  REPLICATE_API_TOKEN: z.string().optional(),
  REPLICATE_THROTTLE_MS: z.coerce.number().positive().default(10_000),

  // Rate limiting
  TRUST_PROXY: z
    .enum(['1', 'true', '0', 'false', ''])
    .optional()
    .transform((v) => v === '1' || v === 'true'),
  RATE_LIMIT_REQUESTS: z.coerce.number().positive().default(30),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().positive().default(60_000),

  // Redis (optional, falls back to in-memory)
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  KV_REST_API_URL: z.string().url().optional(),
  KV_REST_API_TOKEN: z.string().optional(),

  // Feature flags
  FACT_VERIFICATION_ENABLED: z
    .enum(['true', 'false', '1', '0', ''])
    .optional()
    .transform((v) => v !== 'false' && v !== '0'),
  REGULATORY_API_ENABLED: z
    .enum(['true', 'false', '1', '0', ''])
    .optional()
    .transform((v) => v !== 'false' && v !== '0'),
  ECFR_DATE: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),

  // Vercel detection (for proxy trust)
  VERCEL: z.string().optional(),

  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

const clientSchema = z.object({
  NEXT_PUBLIC_IMAGE_PROVIDER: z
    .enum(['dall-e-3', 'gpt-image-1-mini', 'sdxl', 'flux'])
    .optional(),
  NEXT_PUBLIC_TTS_PROVIDER: z.enum(['openai', 'edge', 'kokoro']).optional(),
  NEXT_PUBLIC_VIDEO_PROVIDER: z.enum(['off', 'wan']).optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;
export type ClientEnv = z.infer<typeof clientSchema>;

/**
 * Validate and parse server environment variables.
 * Call this at app startup to fail fast on misconfiguration.
 */
function validateServerEnv(): ServerEnv {
  const result = serverSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    }
    throw new Error('Environment validation failed. Check your .env file.');
  }

  // Warnings for common misconfigurations
  const env = result.data;

  if (!env.OPENAI_API_KEY) {
    console.warn('⚠️  OPENAI_API_KEY not set. Script generation will fail.');
  }

  if (
    (env.IMAGE_PROVIDER === 'sdxl' || env.IMAGE_PROVIDER === 'flux') &&
    !env.REPLICATE_API_TOKEN
  ) {
    console.warn(
      `⚠️  IMAGE_PROVIDER=${env.IMAGE_PROVIDER} requires REPLICATE_API_TOKEN.`
    );
  }

  if (env.TTS_PROVIDER === 'kokoro' && !env.REPLICATE_API_TOKEN) {
    console.warn('⚠️  TTS_PROVIDER=kokoro requires REPLICATE_API_TOKEN.');
  }

  if (env.VIDEO_PROVIDER === 'wan' && !env.REPLICATE_API_TOKEN) {
    console.warn('⚠️  VIDEO_PROVIDER=wan requires REPLICATE_API_TOKEN.');
  }

  return env;
}

/**
 * Validate client-side environment variables (NEXT_PUBLIC_*).
 */
function validateClientEnv(): ClientEnv {
  const result = clientSchema.safeParse({
    NEXT_PUBLIC_IMAGE_PROVIDER: process.env.NEXT_PUBLIC_IMAGE_PROVIDER,
    NEXT_PUBLIC_TTS_PROVIDER: process.env.NEXT_PUBLIC_TTS_PROVIDER,
    NEXT_PUBLIC_VIDEO_PROVIDER: process.env.NEXT_PUBLIC_VIDEO_PROVIDER,
  });

  if (!result.success) {
    console.error('❌ Invalid client environment variables:', result.error.issues);
    throw new Error('Client environment validation failed.');
  }

  return result.data;
}

// Lazy initialization to avoid issues during build time
let _serverEnv: ServerEnv | null = null;
let _clientEnv: ClientEnv | null = null;

/**
 * Server environment variables (validated).
 * Use in API routes and server components only.
 */
export const env: ServerEnv = new Proxy({} as ServerEnv, {
  get(_target, prop: string) {
    if (_serverEnv === null) {
      _serverEnv = validateServerEnv();
    }
    return _serverEnv[prop as keyof ServerEnv];
  },
});

/**
 * Client environment variables (validated).
 * Safe to use in client components (NEXT_PUBLIC_* only).
 */
export const clientEnv: ClientEnv = new Proxy({} as ClientEnv, {
  get(_target, prop: string) {
    if (_clientEnv === null) {
      _clientEnv = validateClientEnv();
    }
    return _clientEnv[prop as keyof ClientEnv];
  },
});

/**
 * Check if a Replicate-dependent provider is configured.
 */
export function requiresReplicate(): boolean {
  return (
    env.IMAGE_PROVIDER === 'sdxl' ||
    env.IMAGE_PROVIDER === 'flux' ||
    env.TTS_PROVIDER === 'kokoro' ||
    env.VIDEO_PROVIDER === 'wan'
  );
}

/**
 * Check if the proxy should be trusted for IP extraction.
 */
export function shouldTrustProxy(): boolean {
  return env.TRUST_PROXY || env.VERCEL === '1';
}
