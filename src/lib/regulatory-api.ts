/**
 * Phase 5: Live regulatory API integration.
 *
 * Fetches current regulation text from eCFR (Electronic Code of Federal Regulations)
 * to keep EHS content evergreen. Falls back to static reference when API is unavailable.
 *
 * eCFR API: https://www.ecfr.gov/developers/documentation/api/v1
 * Example: /api/renderer/v1/content/enhanced/{date}/title-29?part=1910&section=1910.178
 */

export interface RegulationSnippet {
  citation: string;
  text: string;
  source: string;
  effectiveDate: string;
}

export interface RegulatoryApiStatus {
  enabled: boolean;
  lastFetch: string | null;
  regulationsCached: number;
  effectiveDate: string;
}

/** Map 29 CFR section to eCFR API params. Part 1910 = general industry, 1926 = construction. */
const SECTION_TO_ECFR: Record<string, { part: string; subpart?: string }> = {
  '1910.22': { part: '1910', subpart: 'D' },
  '1910.38': { part: '1910', subpart: 'E' },
  '1910.95': { part: '1910', subpart: 'G' },
  '1910.132': { part: '1910', subpart: 'I' },
  '1910.134': { part: '1910', subpart: 'I' },
  '1910.140': { part: '1910', subpart: 'I' },
  '1910.146': { part: '1910', subpart: 'J' },
  '1910.147': { part: '1910', subpart: 'J' },
  '1910.151': { part: '1910', subpart: 'K' },
  '1910.178': { part: '1910', subpart: 'N' },
  '1910.179': { part: '1910', subpart: 'N' },
  '1910.212': { part: '1910', subpart: 'O' },
  '1910.219': { part: '1910', subpart: 'O' },
  '1910.242': { part: '1910', subpart: 'P' },
  '1910.243': { part: '1910', subpart: 'P' },
  '1910.252': { part: '1910', subpart: 'Q' },
  '1910.1030': { part: '1910', subpart: 'Z' },
  '1910.1200': { part: '1910', subpart: 'Z' },
  '1926.451': { part: '1926' },
  '1926.652': { part: '1926' },
  '1926.1427': { part: '1926' },
};

/** Extract section number from refs like "OSHA 1910.178", "29 CFR 1910.178(l)", "1910 Subpart D". */
function parseCitation(ref: string): string | null {
  const m = ref.match(/(\d{4})\.(\d+)/);
  if (m) return `${m[1]}.${m[2]}`;
  return null;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const REQUEST_TIMEOUT_MS = 15_000;
const ECFR_BASE = 'https://www.ecfr.gov';

const cache = new Map<string, { snippet: RegulationSnippet; expires: number }>();
let lastFetchTime: string | null = null;

function getEffectiveDate(): string {
  const d = process.env.ECFR_DATE;
  if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

function buildEcfrUrl(part: string, section: string, subpart?: string): string {
  const date = getEffectiveDate();
  const params = new URLSearchParams({
    subtitle: 'B',
    chapter: 'XVII',
    part,
    section,
  });
  if (subpart) params.set('subpart', subpart);
  return `${ECFR_BASE}/api/renderer/v1/content/enhanced/${date}/title-29?${params}`;
}

/**
 * Fetch a single regulation section from eCFR.
 * Returns null if fetch fails or section is unknown.
 */
export async function fetchRegulationSection(citation: string): Promise<RegulationSnippet | null> {
  const section = parseCitation(citation);
  if (!section) return null;

  const params = SECTION_TO_ECFR[section];
  if (!params) return null;

  const cacheKey = `${section}-${getEffectiveDate()}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() < cached.expires) return cached.snippet;

  const url = buildEcfrUrl(params.part, section, params.subpart);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) return null;

    const data = (await res.json()) as unknown;
    if (!data || typeof data !== 'object') return null;

    let text = '';
    const obj = data as Record<string, unknown>;
    if (obj.part && typeof obj.part === 'object') {
      const part = obj.part as Record<string, unknown>;
      if (typeof part.abstract === 'string') text = part.abstract;
    }
    if (obj.nodes && Array.isArray(obj.nodes)) {
      for (const node of obj.nodes as Array<Record<string, unknown>>) {
        if (Array.isArray(node.content)) {
          text += '\n' + node.content.filter((c): c is string => typeof c === 'string').join(' ');
        }
      }
    }
    if (obj.content && Array.isArray(obj.content)) {
      text += '\n' + (obj.content as string[]).join(' ');
    }
    text = text.trim().replace(/\s+/g, ' ').slice(0, 3000);
    if (!text) return null;

    lastFetchTime = new Date().toISOString();
    const snippet: RegulationSnippet = {
      citation: `29 CFR ${section}`,
      text,
      source: 'eCFR.gov',
      effectiveDate: getEffectiveDate(),
    };
    cache.set(cacheKey, { snippet, expires: Date.now() + CACHE_TTL_MS });
    return snippet;
  } catch {
    return null;
  }
}

/**
 * Fetch regulation text for multiple citations (e.g. from topic regulatoryRefs).
 * Returns a combined context string for prompt augmentation.
 */
export async function fetchRegulationsForCitations(
  citations: string[]
): Promise<{ context: string; snippets: RegulationSnippet[] }> {
  const seen = new Set<string>();
  const snippets: RegulationSnippet[] = [];

  for (const ref of citations) {
    const section = parseCitation(ref);
    if (!section || seen.has(section)) continue;
    seen.add(section);

    const snippet = await fetchRegulationSection(ref);
    if (snippet) snippets.push(snippet);
  }

  if (snippets.length === 0) return { context: '', snippets: [] };

  const lines = [
    `Live regulation excerpts (eCFR, as of ${snippets[0].effectiveDate}):`,
    ...snippets.map((s) => `[${s.citation}] ${s.text}`),
  ];
  return { context: lines.join('\n\n'), snippets };
}

/** Get status for /api/config or health checks. */
export function getRegulatoryApiStatus(): RegulatoryApiStatus {
  return {
    enabled: process.env.REGULATORY_API_ENABLED !== 'false',
    lastFetch: lastFetchTime,
    regulationsCached: cache.size,
    effectiveDate: getEffectiveDate(),
  };
}

/** Clear cache (e.g. for testing). */
export function clearRegulatoryCache(): void {
  cache.clear();
  lastFetchTime = null;
}
