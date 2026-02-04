# EHS Accuracy Improvement Plan

This document outlines the implementation plan for improving EHS (Environmental, Health & Safety) accuracy in safety training video generation. Phase 1 has been implemented; Phases 2–6 are planned for future development.

---

## Phase 1: Expand Static EHS Reference (✅ IMPLEMENTED)

**Effort:** 2–3 days | **Impact:** Medium | **Accuracy gain:** ~+15%

### Summary

Expanded the static EHS reference library from 6 to 21 topics. Each topic includes:
- Keywords for prompt matching
- Key facts and regulatory references (OSHA/ANSI)
- Best practices and common hazards
- Correct terminology vs. terms to avoid
- Myths and misleading claims to flag
- Recommended points to mention
- Relevant safety sign types

### Topics Covered

| ID | Label | Regulatory Reference |
|----|-------|---------------------|
| forklift | Forklift / powered industrial truck safety | OSHA 1910.178 |
| slip-trip-fall | Slip, trip, and fall hazards | OSHA 1910.22 |
| ppe | Personal protective equipment | OSHA 1910.132 |
| fire-evacuation | Fire evacuation and emergency egress | OSHA 1910.38 |
| lockout-tagout | Lockout/tagout (LOTO) | OSHA 1910.147 |
| hazard-communication | Hazard communication (GHS) | OSHA 1910.1200 |
| confined-space | Confined space entry | OSHA 1910.146 |
| fall-protection | Fall protection | OSHA 1910.140 |
| electrical | Electrical safety | OSHA 1910 Subpart S |
| machine-guarding | Machine guarding | OSHA 1910.212 |
| ergonomics | Ergonomics and musculoskeletal disorders | OSHA guidelines |
| bloodborne-pathogens | Bloodborne pathogens | OSHA 1910.1030 |
| respiratory-protection | Respiratory protection | OSHA 1910.134 |
| hearing-conservation | Hearing conservation | OSHA 1910.95 |
| welding-hot-work | Welding and hot work | OSHA 1910.252 |
| hand-power-tools | Hand and power tools | OSHA 1910.242, 243 |
| scaffolding | Scaffolding | OSHA 1926.451 |
| excavation-trenching | Excavation and trenching | OSHA 1926.652 |
| emergency-first-aid | Emergency response and first aid | OSHA 1910.151 |
| heat-stress | Heat stress and illness | OSHA/NIOSH |
| crane-rigging | Crane and rigging operations | OSHA 1910.179, 1926.1427 |

### Files Modified

- `src/lib/ehs-reference.ts` – Added 15 new topics
- `src/lib/ehs-reference.test.ts` – Updated tests for new topics

---

## Phase 2: RAG with OSHA/ANSI Documents

**Effort:** 1–2 weeks | **Impact:** High | **Accuracy gain:** ~+40%

### Overview

Implement Retrieval-Augmented Generation to ground GPT responses in official regulatory documents. Instead of relying solely on static text, the system retrieves relevant passages from indexed OSHA/ANSI documents and injects them into the system prompt.

### Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  User Prompt    │────▶│  Vector Search   │────▶│  Relevant Docs  │
│  "forklift      │     │  (Pinecone/      │     │  - OSHA 1910.178│
│   safety"       │     │   Weaviate)      │     │  - ANSI B56.1   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Final Script   │◀────│  GPT-4 with      │◀────│  Augmented      │
│  with Citations │     │  Retrieved       │     │  System Prompt  │
└─────────────────┘     │  Context         │     └─────────────────┘
                        └──────────────────┘
```

### Implementation Tasks

1. **Vector DB setup**
   - Choose provider: Pinecone, Weaviate, or Supabase pgvector
   - Create index for document chunks
   - Define chunking strategy (e.g., 500 tokens with overlap)

2. **Document ingestion pipeline**
   - Source documents: OSHA eCFR (29 CFR 1910, 1926), ANSI standards
   - Parse and chunk regulatory text
   - Embed with OpenAI `text-embedding-3-small` or similar
   - Store with metadata (regulation ID, section, effective date)

3. **Retrieval integration**
   - New `getRAGContextForPrompt(prompt: string)` in `src/lib/rag-client.ts`
   - Call vector search with user prompt embedding
   - Return top-k chunks with source citations
   - Fallback to static `getContextForPrompt()` if RAG unavailable

4. **API changes**
   - Update `generate-script` route to use RAG when configured
   - Add `RAG_ENABLED` and vector DB env vars
   - Return `sources` array in script response for citation display

5. **Data sources to index**
   - OSHA 29 CFR 1910 (general industry)
   - OSHA 29 CFR 1926 (construction)
   - ANSI Z535.2, B56.1 (where applicable)
   - NIOSH publications (optional)

### Dependencies

- Vector DB SDK (e.g., `@pinecone-database/pinecone`)
- Embedding model API (OpenAI or local)

---

## Phase 3: AI-Powered Fact Verification (✅ IMPLEMENTED)

**Effort:** 1 week | **Impact:** High | **Accuracy gain:** ~+20%

### Summary

Implemented post-generation fact verification. After a script is generated:
1. GPT extracts factual claims (statistics, regulations, procedures, time limits) from each scene
2. Each claim is verified against the static EHS reference and labeled: verified, needs_review, or unverified
3. Results are returned in the script API response and displayed in ScriptEditor with an expandable "Fact verification" panel

Set `FACT_VERIFICATION_ENABLED=false` to disable.

### Files Added/Modified

- `src/lib/fact-verification.ts` – Claim extraction and verification (GPT + EHS reference)
- `src/lib/ehs-reference.ts` – Added `getVerificationContextForTopics()`
- `src/lib/types.ts` – Added `FactVerificationResult`
- `src/app/api/generate-script/route.ts` – Integrated verification
- `src/app/components/ScriptEditor.tsx` – FactVerificationBanner UI

### Overview

Add a verification layer that cross-checks generated script content against authoritative sources. Extracts factual claims and verifies them before or after script generation.

### Interface

```typescript
interface FactVerificationResult {
  claim: string;
  verified: boolean;
  confidence: number;
  source?: string;
  correction?: string;
}

async function verifyScriptFacts(script: ScriptResult): Promise<FactVerificationResult[]>
```

### Implementation Tasks

1. **Claim extraction**
   - Use GPT to extract factual claims from narration (statistics, regulatory citations, procedural steps, time limits)
   - Parse into structured `{ claim, type }` (e.g., `statistic`, `regulation`, `procedure`)

2. **Verification backend**
   - For regulatory claims: search RAG index (Phase 2) or static reference
   - For statistics: flag for manual review or use trusted source APIs
   - Return verification result with source citation or correction suggestion

3. **Integration**
   - Option A: Post-generation verification (run after script is generated, display warnings)
   - Option B: Pre-generation validation (validate key facts in prompt before generation)
   - Recommend Option A for MVP; add Option B later

4. **UI**
   - Display verification status per scene in ScriptEditor
   - Show `Verified`, `Needs review`, or `Corrected` with expandable source
   - Allow user to override or request regeneration

### What to Verify

- Statistics and percentages ("80% of forklift accidents...")
- Regulatory citations ("OSHA requires...")
- Procedural steps ("First, inspect the brakes...")
- Time limits ("Training must be renewed every 3 years...")

---

## Phase 4: SME Review Workflow

**Effort:** 2–3 weeks | **Impact:** Very High | **Accuracy gain:** ~+25% (human verified)

### Overview

Implement a human-in-the-loop review process before video generation. Scripts move through draft → pending review → approved/rejected states, with SME sign-off and audit trail.

### Workflow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Generate    │────▶│  SME Review  │────▶│  Approval /  │────▶│  Generate    │
│  Script      │     │  Queue       │     │  Revision    │     │  Video       │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

### Implementation Tasks

1. **Data model**
   - Add `ReviewStatus` to script/video flow: `draft | pending_review | approved | rejected`
   - Store `reviewedBy`, `reviewedAt`, `approvalSignature` (hash)
   - Support `ReviewComment[]` with inline references (scene index, sentence)

2. **Review queue**
   - New `/api/review-queue` endpoint: list scripts pending review
   - Filter by status, assignee, date
   - Requires auth (next-auth or similar)

3. **Review UI**
   - Dedicated review page: side-by-side script + comment panel
   - Inline comment threading per scene
   - Approve / Request revision / Reject actions
   - Version history of edits

4. **Approval workflow**
   - Digital sign-off with timestamp (audit trail)
   - Optional: integrate with existing LMS or compliance systems
   - Export compliance log for regulatory inspections

5. **Video generation gate**
   - Only allow "Create video" when status is `approved` (or `draft` if SME workflow disabled)
   - Config flag: `SME_REVIEW_REQUIRED`

### Dependencies

- Authentication (NextAuth.js or Clerk)
- Database for review state (Postgres, Vercel Postgres, or Upstash)
- Optional: Real-time updates (e.g., Pusher, Ably) for multi-user review

---

## Phase 5: Regulatory API Integration (✅ IMPLEMENTED)

**Effort:** 3–4 weeks | **Impact:** High | **Accuracy gain:** Evergreen compliance

### Summary

Integrated live regulation fetch from eCFR.gov. When generating scripts:
1. Relevant 29 CFR citations (1910, 1926) are collected from matched EHS topics
2. Regulation text is fetched from eCFR renderer API (cached 24h)
3. Live excerpts are injected into the system prompt alongside static EHS reference
4. Script response includes `regulatorySources` (e.g. "29 CFR 1910.178 (2024-01-15)")
5. Set `REGULATORY_API_ENABLED=false` to use static reference only
6. Set `ECFR_DATE=YYYY-MM-DD` for point-in-time queries

### Files Added/Modified

- `src/lib/regulatory-api.ts` – eCFR client, cache, citation mapping
- `src/lib/ehs-reference.ts` – Added `getCitationsForTopics()`
- `src/app/api/generate-script/route.ts` – Augments prompt with live regulations
- `src/app/api/config/route.ts` – Includes regulatory API status
- `src/app/api/health/route.ts` – Includes regulatory API status
- `src/app/components/ScriptEditor.tsx` – Displays regulatory sources used

### Overview

Connect to live regulatory databases to keep content current. Automatically reflect regulation updates, enforcement trends, and region-specific requirements.

### Data Sources

| Source | API/Method | Content |
|--------|------------|---------|
| OSHA.gov | RSS / web scraping | Latest regulations, enforcement data |
| eCFR | API (gov) | Current 29 CFR text |
| NIOSH | API | Research publications, guidelines |
| ANSI | Subscription API | Current standards |
| State OSHA plans | Various | State-specific requirements (Cal/OSHA, etc.) |

### Implementation Tasks

1. **OSHA/eCFR integration**
   - Use eCFR API or bulk download for 1910, 1926
   - Schedule periodic sync (weekly/monthly)
   - Diff against indexed content; re-embed changed sections
   - Store effective dates and amendment history

2. **Enforcement data (optional)**
   - Fetch recent citations for topic
   - Surface "common violations" in prompt augmentation
   - Display in UI: "OSHA frequently cites..."

3. **Region awareness**
   - Add `region` to user/config: federal OSHA vs. state plan
   - Filter or prioritize state-specific rules when applicable
   - e.g., California: additional Cal/OSHA requirements

4. **Versioning**
   - Tag regulatory snapshots with date
   - Allow "as of [date]" for historical accuracy
   - Audit log: which regulation version was used for each video

### Considerations

- Rate limits and terms of use for each API
- Fallback to static/RAG when APIs unavailable
- Caching strategy to minimize API calls

---

## Phase 6: AI-Assisted Competency Assessment (Future)

**Effort:** TBD | **Impact:** Compliance with OSHA 2026 | **Accuracy gain:** N/A (new capability)

### Overview

Per emerging OSHA 2026 requirements, employers must document worker competency with annual verification. Add post-video quizzes and competency tracking.

### Features

- Post-video quizzes generated from script content
- Competency tracking per employee
- Gap analysis to identify retraining needs
- Digital certificates for compliance records

### Status

Deferred until requirements are finalized; architecture depends on Phases 2–4.

---

## Summary: Implementation Order

| Phase | Improvement | Effort | Accuracy Gain | Status |
|-------|-------------|--------|---------------|--------|
| 1 | Expand EHS topics to 21 | 2–3 days | +15% | ✅ Done |
| 2 | RAG with OSHA documents | 1–2 weeks | +40% | Planned |
| 3 | Fact verification layer | 1 week | +20% | ✅ Done |
| 4 | SME review workflow | 2–3 weeks | +25% (human) | Planned |
| 5 | Live regulatory API | 3–4 weeks | Evergreen | ✅ Done |
| 6 | Competency assessment | TBD | New capability | Future |

### Recommended Next Steps

1. **Short-term:** Implement Phase 2 (RAG) for maximum accuracy gain with moderate effort.
2. **Medium-term:** Add Phase 4 (SME review) for enterprise customers needing human accountability.
3. **Long-term:** Phase 5 for evergreen compliance; Phase 6 when OSHA 2026 details are clear.

The combination of **RAG + SME review** provides both AI efficiency and human accountability—critical for safety training where incorrect content can result in workplace injuries.
