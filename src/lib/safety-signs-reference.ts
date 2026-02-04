/**
 * Cross-reference for safety signage (ANSI Z535.2 / OSHA 1910.145).
 * Used to identify sign mentions that can be verified vs. unverifiable/bad signs.
 * @see https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.145
 * @see ANSI Z535.2 facility safety signs
 */

/** Allowed signal words (header severity). */
export const ALLOWED_SIGNAL_WORDS = [
  'DANGER',
  'WARNING',
  'CAUTION',
  'NOTICE',
  'EXIT',
  'SAFETY INSTRUCTION',
  'PPE REQUIRED',
  'EYE PROTECTION REQUIRED',
  'HEARING PROTECTION REQUIRED',
  'HARD HAT AREA',
  'NO SMOKING',
  'FIRE EXTINGUISHER',
  'FIRST AID',
  'EMERGENCY EXIT',
  'WET FLOOR',
  'SLIPPERY WHEN WET',
  'KEEP CLEAR',
  'AUTHORIZED PERSONNEL ONLY',
] as const;

/** Normalized set for lookup. */
const ALLOWED_SET = new Set(
  ALLOWED_SIGNAL_WORDS.flatMap((w) => [w, w.replace(/\s+/g, ' ')])
);

/** Patterns that indicate a standard sign (signal word + optional suffix). */
const SIGNAL_WORD_PATTERN = /\b(DANGER|WARNING|CAUTION|NOTICE|EXIT|PPE|SAFETY|EMERGENCY|FIRE|FIRST\s*AID|WET\s*FLOOR|HARD\s*HAT|EYE\s*PROTECTION|HEARING\s*PROTECTION|NO\s*SMOKING|AUTHORIZED\s*PERSONNEL|KEEP\s*CLEAR|SLIPPERY)\s*([A-Za-z\s]*)?/gi;

/**
 * Normalize a sign-like phrase for comparison (uppercase, collapse spaces).
 */
function normalize(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toUpperCase();
}

/**
 * Extract sign-like phrases from text (signal words and short following phrase).
 */
function extractSignMentions(text: string): string[] {
  const seen = new Set<string>();
  const mentions: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(SIGNAL_WORD_PATTERN.source, 'gi');
  while ((m = re.exec(text)) !== null) {
    const phrase = normalize((m[1] + ' ' + (m[2] ?? '')).trim());
    if (phrase.length > 0 && !seen.has(phrase)) {
      seen.add(phrase);
      mentions.push(phrase);
    }
  }
  return mentions;
}

/**
 * Check if a single phrase is in the allowed reference (exact or starts with allowed signal word).
 */
function isPhraseAllowed(phrase: string): boolean {
  const n = normalize(phrase);
  if (ALLOWED_SET.has(n)) return true;
  for (const allowed of ALLOWED_SIGNAL_WORDS) {
    if (n === allowed || n.startsWith(allowed + ' ')) return true;
  }
  return false;
}

/**
 * Returns sign mentions in the text that are NOT in the allowed reference.
 * Use this to identify "bad" or unverifiable signs that should be flagged or removed.
 */
export function getUnverifiedSignMentions(text: string): string[] {
  const mentions = extractSignMentions(text);
  return mentions.filter((m) => !isPhraseAllowed(m));
}

/**
 * Returns true if the text contains no sign-like phrases, or all sign mentions
 * match the allowed reference.
 */
export function hasOnlyVerifiedSigns(text: string): boolean {
  const unverified = getUnverifiedSignMentions(text);
  return unverified.length === 0;
}
