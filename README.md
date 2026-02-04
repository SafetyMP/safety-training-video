# Safety Training Video Creator

**Copyright 2026 Sage Hart.** Licensed under the [Apache License 2.0](LICENSE).

Create **professional safety training videos** from natural language. Describe the video you want (e.g. "2-minute video about forklift safety in a warehouse"), and the app will:

1. **Generate a script** – Scene-by-scene narration with image prompts that accurately depict the narration (via OpenAI GPT), with optional fact verification against EHS regulations.
2. **Generate illustrations** – One illustration per scene with realistic proportions and consistent characters (DALL·E 3/SDXL/Flux Dev).
3. **Generate narration** – Text-to-speech for each scene (OpenAI TTS, Edge TTS, or Kokoro) with **18 voice options** organized by category.
4. **Assemble the video** – Stitch images and audio into an MP4 with **synchronized timed captions** (FFmpeg).

## Prerequisites

- **Node.js** 18+
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

   Copy `.env.example` to `.env` and set your OpenAI API key:

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
2. Set **Options**:
   - **Audience**: All / New hires / Refresher
   - **Voice**: Choose from 18 voices organized by category (Authoritative, Professional, Friendly, Warm, Energetic). The app suggests voices based on your topic!
   - **Visual style**: Illustration, realistic, semi-realistic, stylized 3D
   - **Draft mode**: 3 scenes, lower cost
   - **High-quality images**: More detail, higher cost
   - **Closed captions**: Burn synchronized, timed narration into the video
3. Click **Generate script** – you'll see a title and editable scene list with narration.
4. Edit narration if you like, then click **Create video** – the app generates images and audio per scene, then assembles the MP4.
5. Watch the result, use **Regenerate scene** for any single scene if needed, then **Download video**.

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

### Timed Captions
Captions are synchronized with narration using word-weighted timing. Longer phrases display proportionally longer, matching natural speech rhythm.

### Image Quality
The image generation includes built-in quality prompts for:
- Anatomically correct humans with proper proportions
- Realistic hands with correct finger count
- Physically connected objects (no floating elements)
- Single-person scenes to prevent ghost figures

### Fact Verification
Scripts are automatically verified against EHS (Environmental Health & Safety) reference data. Claims about regulations, procedures, and statistics are flagged for review if they can't be verified.

## Project structure

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
└── docs/                    # Implementation plans
```

## Testing video generation

1. **One-time setup:** Install dependencies and set your OpenAI API key:
   ```bash
   npm install
   cp .env.example .env
   # Edit .env and set OPENAI_API_KEY=sk-...
   ```

2. **Automated API test** (script + one image + one audio; no full video):
   - In one terminal: `npm run dev`
   - In another terminal: `npm run test:video`
   - The script calls `/api/generate-script`, then one `/api/generate-image` and one `/api/generate-audio`. If all succeed, the pipeline is working.

3. **Full video in the browser:**
   - Run `npm run dev` and open [http://localhost:3000](http://localhost:3000).
   - Enter a prompt (e.g. "A safety training video about forklift safety in a warehouse").
   - Click **Generate script**, then **Create video**. Download the MP4 when it finishes.
   - **Note:** Full video requires FFmpeg installed (`brew install ffmpeg` on macOS).

## Notes

- **API costs:** See [Estimated cost per video](#estimated-cost-per-video) above. Cost depends on length and scene count.
- **Payload size:** Many or long scenes mean a large request to `/api/assemble-video`. If you hit body size limits, reduce the number of scenes or deploy with a higher limit.
- **Compliance:** Treat generated content as a draft. Have safety or legal review before using in official training.

## License

This project is licensed under the Apache License 2.0. See [LICENSE](LICENSE) for the full text. Copyright 2026 Sage Hart.
