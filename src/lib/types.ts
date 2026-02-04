export interface Scene {
  narration: string;
  imagePrompt: string;
  /** Estimated duration in seconds (for TTS we'll get real duration) */
  duration?: number;
}

export interface UnverifiedSignMention {
  sceneIndex: number;
  mentions: string[];
}

/** EHS reference validation result; augments and checks script content. */
export interface EHSValidation {
  topicIds: string[];
  warnings: string[];
  terminologySuggestions: { found: string; prefer: string }[];
  mythsFlagged: string[];
  missingRecommendations: string[];
}

/** Single factual claim verification result (Phase 3). */
export interface FactVerificationResult {
  claim: string;
  sceneIndex: number;
  type: 'statistic' | 'regulation' | 'procedure' | 'time_limit' | 'other';
  status: 'verified' | 'needs_review' | 'unverified';
  confidence: number;
  /** Chain-of-thought reasoning explaining how the claim was verified against the reference. */
  reasoning?: string;
  source?: string;
  correction?: string;
}

export interface ScriptResult {
  title: string;
  /** One sentence describing the same art style for every scene (for consistent look) */
  visualStyle?: string;
  scenes: Scene[];
  /** Sign-like phrases not in the safety-signs reference (ANSI/OSHA); flag for review. */
  unverifiedSignMentions?: UnverifiedSignMention[];
  /** EHS reference check: warnings, terminology, myths, missing points. */
  ehsValidation?: EHSValidation;
  /** Fact verification: per-claim status (verified, needs_review, unverified). */
  factVerification?: FactVerificationResult[];
  /** Live regulation citations used (Phase 5; e.g. "29 CFR 1910.178 (2024-01-15)"). */
  regulatorySources?: string[];
}

export interface SceneAssets {
  sceneIndex: number;
  /** Static image (Tier 1/2). Omit when videoBase64 is set. */
  imageBase64?: string;
  /** AI-generated video clip (Tier 3). Omit when imageBase64 is set. */
  videoBase64?: string;
  audioBase64: string;
  durationSeconds: number;
  /** Narration text for burn-in captions (optional) */
  narration?: string;
}
