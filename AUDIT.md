# Codebase Audit: Safety Training Video Creator

**Date:** January 29, 2026  
**Stack:** Next.js 16, React 18, TypeScript, OpenAI API, FFmpeg

---

## 1. Overview

The app is a **Safety Training Video Creator**: users describe a safety topic in plain language, the app generates a cartoon-style script via GPT, then produces images (DALL·E 3), TTS audio (OpenAI), and assembles a video with FFmpeg. Single-page flow: prompt → script → edit scenes → create video → download.

**Key paths:**
- **Frontend:** `src/app/page.tsx` (client component), `layout.tsx`, `globals.css`
- **API:** `src/app/api/generate-script`, `generate-image`, `generate-audio`, `assemble-video`, `health`
- **Shared:** `src/lib/openai-client.ts`, `retry.ts`, `types.ts`

---

## 2. Strengths

| Area | Notes |
|------|------|
| **Structure** | Clear separation: API routes, lib utilities, shared types. Next.js App Router used consistently. |
| **TypeScript** | `strict: true`, proper interfaces in `types.ts`, typed API bodies. |
| **Resilience** | `withRetry()` in lib used by script/image/audio routes; client has `fetchWithRetry()` for HTTP. Exponential backoff in `retry.ts`. |
| **Cleanup** | `assemble-video` creates a temp dir per request and runs `cleanup()` on success and on every error path. |
| **UX** | Progress (phase, ETA), error messages, “Create another video”, regenerate single scene. |
| **Accessibility** | `role="main"`, `aria-label` on main and video, `aria-live="polite"` on progress, `aria-busy`/`aria-disabled` on buttons, labels/ids on form fields. |
| **Secrets** | `.env` in `.gitignore`, `.env.example` documents `OPENAI_API_KEY` only. |
| **Script parsing** | `JSON.parse` errors are caught by the outer `try/catch` and returned as 500. |

---

## 3. Security

| Finding | Severity | Recommendation |
|--------|----------|----------------|
| **No authentication** | High | APIs are public; anyone can consume OpenAI and server resources. Add auth (e.g. API key, OAuth, or at least rate limiting by IP) before exposing. |
| **No rate limiting** | High | Enables DoS and runaway OpenAI cost. Add rate limits (e.g. per IP or per user) on `/api/generate-*` and `/api/assemble-video`. |
| **No input size limits** | Medium | `generate-script`: prompt length unbounded. `generate-image`: prompt built from style + narration + imagePrompt, unbounded. `generate-audio`: text length unbounded (TTS has limits). `assemble-video`: scene count and base64 payload size unbounded → risk of OOM or disk exhaustion. | Enforce max length for prompts/text (e.g. 2k–4k chars), max scenes (e.g. 10–20), and max request body size (e.g. 10–20 MB) in middleware or routes. |
| **Health endpoint** | Low | `GET /api/health` exposes `openaiConfigured`. Minor information disclosure; acceptable for dev, consider restricting in production. |

**Positive:** No SQL/NoSQL; no user-supplied data in file paths (temp paths are server-controlled); `.env` not committed.

---

## 4. Reliability & Error Handling

| Finding | Severity | Recommendation |
|--------|----------|----------------|
| **Script schema** | Medium | Only `parsed.title` and `Array.isArray(parsed.scenes)` are checked. Scenes are not validated for `narration` / `imagePrompt`. Invalid or missing fields can cause later 500s in image/audio or confusing UX. | Validate each scene (e.g. with Zod) and optionally coerce or reject malformed scripts. |
| **Assemble-video on failure** | Low | If `runSegment` fails and the fallback (no drawtext) also fails, the error is rethrown and cleanup runs. No leak. |
| **Client blob URL** | Low | `videoBlobUrl` is revoked in “Create another video” and before reassignment in `handleRegenerateScene`. Good. |
| **No request timeouts** | Low | Long-running `assemble-video` or OpenAI calls could hang. Consider `AbortController` / timeout in route handlers or infrastructure. |

---

## 5. Performance & Resources

| Finding | Severity | Recommendation |
|--------|----------|----------------|
| **Scene count unbounded** | Medium | UI suggests 3–6 scenes, but API accepts any number. Large `scenes[]` in `assemble-video` increases memory, disk, and FFmpeg load. | Enforce a max scene count (e.g. 10) in `assemble-video` and optionally in `generate-script`. |
| **Large base64 in JSON** | Medium | Full image and audio base64 in request/response bodies increases memory and payload size. | Consider streaming, multipart uploads, or temporary object storage (e.g. S3) and pass URLs to the assembler. |
| **Duplicate retry logic** | Low | Client has its own `fetchWithRetry`; APIs use `withRetry`. Both are reasonable (client retries HTTP, server retries OpenAI). Optional: extract a small `fetchWithRetry` helper for the client to avoid duplication. |

---

## 6. Code Quality & Maintainability

| Finding | Severity | Recommendation |
|--------|----------|----------------|
| **Type-only validation** | Low | Request bodies are cast (e.g. `as ScriptResult`) without runtime validation. Malformed or malicious JSON could slip through. | Add runtime validation (e.g. Zod) for API request/response shapes where it matters. |
| **Magic numbers** | Low | E.g. `SECONDS_PER_SCENE = 28`, `ASSEMBLY_SECONDS = 15`, `MIN_SCENE_DURATION = 3`, caption length 120. | Centralize in a small constants module or config. |
| **Test coverage** | Low | No unit or integration tests. `scripts/test-video-generation.mjs` is a useful manual E2E against a running server. | Add unit tests for `retry.ts`, validation, and key API logic; consider integration tests for one full flow. |

---

## 7. Accessibility

- **Good:** Main landmark, labels, progress announced, button states, focus styles.
- **Improve:** Ensure focus moves to the new step (e.g. script result or error) after async actions so keyboard/screen-reader users get clear feedback.

---

## 8. Recommendations Summary

**High priority**
1. Add **authentication** or at least **rate limiting** before public deployment.
2. Add **input and payload limits**: max prompt/text length, max scenes, max body size for `assemble-video`.

**Medium priority**
3. **Validate script schema** (and optionally other API payloads) with Zod or similar.
4. **Cap scene count** in `assemble-video` (and optionally in script generation).
5. Consider **streaming or external storage** for large media to reduce memory and payload size.

**Low priority**
6. Add **request timeouts** for long-running routes.
7. Centralize **constants** and add **runtime validation** for API types.
8. Add **unit tests** for retry and validation; keep/expand the script-based E2E.

---

## 9. File Checklist

| File | Purpose | Audited |
|------|---------|--------|
| `src/app/page.tsx` | Main UI, state, API calls | ✅ |
| `src/app/layout.tsx` | Root layout, metadata | ✅ |
| `src/app/globals.css` | Tailwind, CSS variables | ✅ |
| `src/app/api/generate-script/route.ts` | GPT script generation | ✅ |
| `src/app/api/generate-image/route.ts` | DALL·E 3 image | ✅ |
| `src/app/api/generate-audio/route.ts` | TTS audio | ✅ |
| `src/app/api/assemble-video/route.ts` | FFmpeg concat + captions | ✅ |
| `src/app/api/health/route.ts` | Health + OpenAI check | ✅ |
| `src/lib/openai-client.ts` | OpenAI client | ✅ |
| `src/lib/retry.ts` | Retry helper | ✅ |
| `src/lib/types.ts` | Shared types | ✅ |
| `scripts/test-video-generation.mjs` | E2E test script | ✅ |
| `package.json`, `next.config.js`, `tsconfig.json`, `.gitignore`, `.env.example` | Config | ✅ |

---

*End of audit.*
