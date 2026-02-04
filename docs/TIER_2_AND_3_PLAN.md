# Tier 2 & 3 Implementation Plan

This document outlines the plan to implement Tier 2 (self-hosted SDXL/Flux + Kokoro TTS) and Tier 3 (AI video generation) with the ability to switch between tiers via configuration.

---

## Current Architecture (Tier 1 Implemented)

- **Image providers**: `dall-e-3` | `gpt-image-1-mini` (via `IMAGE_PROVIDER`)
- **TTS providers**: `openai` | `edge` (via `TTS_PROVIDER`)
- **Pipeline**: static images + audio → FFmpeg assembly → MP4

---

## Tier 2: Medium Investment (90% cost reduction) ✅ IMPLEMENTED

**Goal**: SDXL/Flux for images; Kokoro TTS for audio. All via Replicate API (no GPU infra).

### 2.1 Image Provider: SDXL / Flux ✅

- **sdxl**: `stability-ai/sdxl` via Replicate (~$0.001–0.002/image)
  - 25-50 inference steps, good quality
- **flux**: `black-forest-labs/flux-dev` via Replicate (~$0.025/image)
  - Up to 50 inference steps, highest Replicate quality
  - Includes anatomical quality prompts (proper hands, connected objects)
  - 16:9 aspect ratio for video frames
  - Recommended for safety training with human subjects
- Env: `IMAGE_PROVIDER=sdxl` or `flux`, `REPLICATE_API_TOKEN`

### 2.2 TTS Provider: Kokoro ✅

- **kokoro**: `jaaari/kokoro-82m` via Replicate (~$0.00022/run)
- Output: WAV (pipeline accepts via contentType); client `getAudioDuration` supports `audio/wav`
- Env: `TTS_PROVIDER=kokoro`, `REPLICATE_API_TOKEN`

### 2.3 Cost Constants ✅

- `EST_COST_IMAGE['sdxl']` = { standard: $0.001, hd: $0.002 }
- `EST_COST_IMAGE['flux']` = { standard: $0.025, hd: $0.025 } (Flux Dev)
- `EST_COST_TTS_PER_1K['kokoro']` = { standard: $0, draft: $0 } (negligible)

---

## Tier 3: AI Video Generation (Highest Quality) ✅ IMPLEMENTED

**Goal**: Replace static images with actual video clips via Replicate Wan 2.1 T2V.

### 3.1 Video Provider Abstraction ✅

- **wan**: `wavespeedai/wan-2.1-t2v-480p` via Replicate (~$0.01–0.05/run, ~5s output)
- Interface: `generate(params): Promise<{ videoBase64, durationSeconds }>`
- Env: `VIDEO_PROVIDER=wan`, `REPLICATE_API_TOKEN`
- Client fetches `/api/config` to know when to call `/api/generate-video` vs `/api/generate-image`

### 3.2 Assemble-Video Route Changes ✅

- Schema: `imageBase64` OR `videoBase64` per scene (validated via refine)
- Video segments: `-stream_loop -1` to loop video to match audio length; `-shortest` for output
- FFmpeg: scale, pad, fades, captions apply to both image and video inputs

### 3.3 Client & Types ✅

- `SceneAssets`: optional `videoBase64`; when set, omit `imageBase64`
- `generateSceneAsset`: when config.videoProvider === 'wan', calls generate-video + generate-audio
- Cost: `EST_COST_VIDEO['wan']`, `CLIENT_VIDEO_PROVIDER` / `NEXT_PUBLIC_VIDEO_PROVIDER`

### 3.4 Self-Hosted Video Models (LTXVideo, HunyuanVideo) – Future

- **LTXVideo**: 12GB VRAM, ComfyUI workflow or Python script
- **HunyuanVideo**: 14GB+ VRAM
- Run on cloud GPU (RunPod, Vast.ai) or local workstation
- Expose HTTP API: `POST /generate` with prompt → returns video file/URL

### 3.4 Avatar Option (Synthesia/HeyGen)

- **Provider ID**: `synthesia` | `heygen`
- Different flow: script → avatar video (text-to-video with talking head)
- API: upload script, receive video URL
- Cost: $2–10 per video; premium tier
- Env: `AVATAR_PROVIDER=synthesia`, `SYNTHESIA_API_KEY`

---

## Switching Between Tiers

### Env Configuration Summary

| Tier | IMAGE_PROVIDER | TTS_PROVIDER | VIDEO_PROVIDER |
|------|----------------|--------------|----------------|
| 1 (default) | dall-e-3 | openai | (off) |
| 1 (cheap)   | gpt-image-1-mini | edge | (off) |
| 2 ✅        | sdxl or flux | kokoro | (off) |
| 3 ✅        | (any) | (any) | wan |
| 3 (avatar)  | (n/a) | (n/a) | synthesia or heygen – future |

### Runtime Provider Selection

Providers are resolved at request time via `getImageProvider()`, `getTTSProvider()`, and (future) `getVideoProvider()`. No code changes needed to switch—only env vars.

---

## Implementation Order

1. **Tier 2.1** – SDXL/Flux via Replicate or Fal (quickest path)
2. **Tier 2.2** – Kokoro via hosted API or sidecar
3. **Tier 3.1** – Video provider interface + Kling API (cloud)
4. **Tier 3.2** – Self-hosted LTXVideo/Hunyuan (requires GPU infra)
5. **Tier 3.3** – Avatar providers (Synthesia, HeyGen)

---

## Files to Create/Modify (Tier 2)

```
src/lib/providers/
├── image-providers.ts   # add sdxl, flux
├── tts-providers.ts     # add kokoro
└── (future) video-providers.ts

src/app/api/
├── generate-image/route.ts  # uses getImageProvider()
├── generate-audio/route.ts  # uses getTTSProvider()
└── (future) generate-video/route.ts  # new endpoint for video clips

src/lib/constants.ts     # add EST_COST_* for new providers
.env.example             # document new env vars
```

---

## References

- [Replicate SDXL](https://replicate.com/stability-ai/sdxl)
- [Fal.ai Flux](https://fal.ai/models/fal-ai/flux)
- [Kokoro TTS](https://github.com/hexgrad/kokoro)
- [LTX Video](https://github.com/YoungSeng/LTX-Video)
- [Kling AI API](https://klingai.com/)
