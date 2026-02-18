# Safety Training Video Creator

[![CI](https://github.com/SafetyMP/safety-training-video/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/SafetyMP/safety-training-video/actions/workflows/ci.yml)

**Copyright 2026 Sage Hart.** Licensed under the [Apache License 2.0](LICENSE).

Generate **professional safety training videos** in minutes from a short description—no video production experience required. The app produces scene-by-scene scripts, illustrations, narration, and a finished MP4 with timed captions, with optional fact-checking against EHS (Environmental, Health & Safety) references.

**For business users:** Describe the topic (e.g. "forklift safety in a warehouse"); choose audience, voice, and style; get a draft video you can refine or download. Ideal for training coordinators, EHS managers, and teams who need consistent, low-cost safety content.

**For technical users:** Next.js 16 app with TypeScript, OpenAI APIs, optional Replicate (SDXL/Flux/Kokoro), and FFmpeg. Configure providers via env; run locally or deploy. See [Prerequisites](#prerequisites) and [Setup](#setup) below, and [Project structure](#project-structure) for the codebase.

---

Create a video by describing it. Example: "2-minute video about forklift safety in a warehouse." The app will:

1. **Generate a script** – Scene-by-scene narration with image prompts that accurately depict the narration (via OpenAI GPT), with optional fact verification against EHS regulations.
2. **Generate illustrations** – One illustration per scene with realistic proportions and consistent characters (DALL·E 3/SDXL/Flux Dev).
3. **Generate narration** – Text-to-speech for each scene (OpenAI TTS, Edge TTS, or Kokoro) with **18 voice options** organized by category.
4. **Assemble the video** – Stitch images and audio into an MP4 with **synchronized timed captions** (FFmpeg).

### Use cases

- **Compliance and onboarding** – Quick refreshers or new-hire safety modules (PPE, fire evacuation, slip/trip hazards).
- **Topic-specific training** – Focused videos on forklift safety, lockout-tagout, confined space, etc., with narration aligned to your audience.
- **Draft content for review** – Generate a draft, then have safety or legal review before rollout (recommended; see [Notes](#notes)).

## Prerequisites

- **Node.js** 20+ (Next.js requires >=20.9.0)
- **OpenAI API key** – Used for script (GPT), images (DALL·E 3), and narration (TTS). [Get one here](https://platform.openai.com/api-keys).
- **FFmpeg** – Used to build the final video. The app will use the `ffmpeg-static` binary if available; otherwise it uses `ffmpeg` from your system PATH.  
  - macOS: `brew install ffmpeg`  
  - Ubuntu: `sudo apt install ffmpeg`

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment**

   Copy `.env.example` to `.env` and set your OpenAI API key. See `.env.example` for all options (providers, rate limiting, feature flags).

   ```bash
   cp .env.example .env
   # Edit .env and set OPENAI_API_KEY=sk-...
   ```

3. **Run the app**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## How to use

1. Enter a short description of the safety video (or use a **template**: Forklift safety, Slip and trip hazards, PPE basics, Fire evacuation).
2. Set options: audience, voice, visual style, and quality. See [Options](#options) below.
3. Click **Generate script** -- you'll see a title and editable scene list with narration.
4. Edit narration if you like, then click **Create video** -- the app generates images and audio per scene, then assembles the MP4.
5. Watch the result, use **Regenerate scene** for any single scene if needed, then **Download video**.

### Options

| Option | Choices | Notes |
|--------|---------|-------|
| **Audience** | All / New hires / Refresher | Adjusts tone and complexity |
| **Voice** | 18 voices in 5 categories | The app suggests a voice based on your topic |
| **Visual style** | Illustration, realistic, semi-realistic, stylized 3D | |
| **Draft mode** | On / Off | 3 scenes instead of 6; lower cost |
| **High-quality images** | On / Off | More detail; higher cost |
| **Closed captions** | On / Off | Burns synchronized timed narration into the video |

### Voice Categories

| Category | Best For | Example Voices |
|----------|----------|----------------|
| **Authoritative** | Serious topics (lockout-tagout, confined space) | Onyx, Guy, Davis |
| **Professional** | Compliance/corporate training | Alloy, Jenny, Jason |
| **Friendly** | General safety awareness | Nova, Jane, Tony |
| **Warm** | Sensitive topics (first aid, mental health) | Echo, Sara, Nancy |
| **Energetic** | Engaging content, new hire orientation | Shimmer, Aria, Andrew |

## Estimated cost per video

Costs depend on which providers you configure. The app supports multiple tiers:

### Provider Cost Comparison

| Provider | Cost | Notes |
|----------|------|-------|
| **Images** | | |
| DALL·E 3 | $0.04–$0.08/image | Highest quality OpenAI |
| GPT Image Mini | $0.01–$0.04/image | Good balance |
| SDXL | ~$0.002/image | Replicate, good quality |
| Flux Dev | ~$0.025/image | Replicate, high quality |
| **Video (Tier 3)** | | |
| Wan 2.1 T2V | ~$0.35/clip | ~5s AI video clips ($0.07/sec) |
| **TTS** | | |
| OpenAI TTS | $0.015–$0.03/1k chars | Best quality |
| Edge TTS | Free | Microsoft, good quality |
| Kokoro | Free | Replicate, expressive |
| **Script** | | |
| GPT-4o-mini | ~$0.002/script | Includes fact verification |

### Example Costs (3-scene draft video)

| Configuration | Est. Cost | Notes |
|---------------|-----------|-------|
| **Tier 1**: DALL·E 3 + OpenAI TTS | ~$0.15–$0.25 | Highest quality |
| **Tier 2**: SDXL + Kokoro | ~$0.01–$0.02 | Best value |
| **Tier 2**: Flux Dev + Kokoro | ~$0.08–$0.10 | High quality Replicate |
| **Tier 3**: Wan Video + Kokoro | ~$1.05–$1.10 | AI video clips! |

**Ways to reduce cost:**
- Use **Draft mode** (3 scenes instead of 6)
- Use SDXL or Flux Dev instead of DALL·E 3
- Use Edge TTS or Kokoro instead of OpenAI TTS
- Disable fact verification (`FACT_VERIFICATION_ENABLED=false`) to skip extra OpenAI call
- Use **Regenerate scene** to fix individual scenes instead of regenerating the whole video

## Features

### Fact Verification

Generated scripts are checked for accuracy at three levels:

1. **EHS reference library** – A built-in dataset of 21 safety topics (PPE, lockout-tagout, confined spaces, etc.) with regulations, best practices, and common misconceptions. Scripts are cross-referenced automatically.
2. **AI verification** – A second GPT pass reviews the generated script for unsupported claims about regulations, procedures, or statistics. Unverifiable claims are flagged for human review.
3. **Live regulatory lookup** – The app queries the eCFR.gov API to pull current OSHA regulation text, so verification stays up to date as rules change.

All three layers run by default. Disable with `FACT_VERIFICATION_ENABLED=false` to skip the extra API call.

### Swappable Providers

Image generation, text-to-speech, and video clip providers are abstracted behind consistent interfaces. Switch providers by changing environment variables -- no code changes required. This lets you choose the cost/quality tradeoff that fits your use case, from free (Edge TTS, SDXL) to premium (DALL·E 3, OpenAI TTS). See [Estimated cost per video](#estimated-cost-per-video) for a full comparison.

### Timed Captions

Captions are synchronized with narration using word-weighted timing. Longer phrases display proportionally longer, matching natural speech rhythm. Captions are burned into the MP4 during FFmpeg assembly.

### Image Quality

Image prompts are automatically refined per provider (natural language for DALL·E 3, keyword-tag format for SDXL, style-positioned for Flux). Built-in quality constraints enforce:
- Anatomically correct humans with proper proportions
- Realistic hands with correct finger count
- Physically connected objects (no floating elements)
- Single-person scenes to prevent ghost figures

### Output

Videos are assembled as MP4 files (H.264) with fade transitions between scenes. Each scene pairs one illustration (or AI video clip in Tier 3) with its narration audio. Typical output is 1–3 minutes for a 3–6 scene video. Resolution matches the image provider (1024x1024 for DALL·E 3, varies by provider).

## Project structure

**Stack:** Next.js 16 (App Router), React 18, TypeScript, Tailwind CSS. APIs: OpenAI (script, images, TTS), optional Replicate (SDXL/Flux/Kokoro/Wan), Edge TTS; FFmpeg for assembly.

```
src/
├── app/
│   ├── api/
│   │   ├── health/          # Health check endpoint
│   │   ├── config/          # Provider config for client
│   │   ├── generate-script/ # GPT script generation + fact verification
│   │   ├── generate-image/  # DALL·E 3 / SDXL / Flux Dev
│   │   ├── generate-audio/  # OpenAI TTS / Edge / Kokoro
│   │   ├── generate-video/  # Wan 2.1 T2V (Tier 3)
│   │   └── assemble-video/  # FFmpeg assembly with timed captions
│   ├── components/          # React components
│   ├── contexts/            # State management (VideoFlow, Cost, Theme)
│   └── hooks/               # Custom hooks
├── lib/
│   ├── providers/           # Image, TTS, Video provider abstractions
│   ├── constants.ts         # Voices, costs, visual styles
│   ├── ehs-reference.ts     # Safety regulation data
│   ├── fact-verification.ts # AI fact checking
│   └── schemas.ts           # Zod validation schemas
└── docs/                    # EHS accuracy plan, Tier 2/3 provider plans
```

## Testing video generation

After completing [Setup](#setup):

1. **Automated API test** (script + one image + one audio; no full video):
   - In one terminal: `npm run dev`
   - In another terminal: `npm run test:video`
   - The script calls `/api/generate-script`, then one `/api/generate-image` and one `/api/generate-audio`. If all succeed, the pipeline is working.

2. **Full video in the browser:**
   - Run `npm run dev` and open [http://localhost:3000](http://localhost:3000).
   - Enter a prompt (e.g. "A safety training video about forklift safety in a warehouse").
   - Click **Generate script**, then **Create video**. Download the MP4 when it finishes.

## Notes

> **⚠ Production deployment:** This app has no built-in authentication. Every API route calls paid external services (OpenAI, Replicate). Before any shared or public deployment, add authentication and review rate limiting configuration. See [SECURITY.md](SECURITY.md) and [AUDIT.md](AUDIT.md) for guidance.

- **API costs:** See [Estimated cost per video](#estimated-cost-per-video) above. Cost depends on length and scene count.
- **Payload size:** Many or long scenes mean a large request to `/api/assemble-video`. If you hit body size limits, reduce the number of scenes or deploy with a higher limit.
- **Compliance:** Treat generated content as a draft. Have safety or legal review before using in official training.

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, code style, and the pull request process. By participating, you agree to uphold our [Code of Conduct](CODE_OF_CONDUCT.md). Security issues should be reported as described in [SECURITY.md](SECURITY.md).

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for release history.

## License

This project is licensed under the Apache License 2.0. See [LICENSE](LICENSE) for the full text. Copyright 2026 Sage Hart. See [NOTICE](NOTICE) for attribution.
