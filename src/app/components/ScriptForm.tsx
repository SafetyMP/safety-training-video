'use client';

import { useState } from 'react';
import { Button } from '@/app/components/shared/Button';
import { Card } from '@/app/components/shared/Card';
import { useCostContext } from '@/app/contexts/CostContext';
import { useVideoFlow } from '@/app/contexts/VideoFlowContext';
import { VOICES, AUDIENCES, TEMPLATES, VISUAL_STYLE_PRESETS, getRecommendedVoice } from '@/lib/constants';
import { MAX_PROMPT_LENGTH } from '@/lib/constants';
import type { VisualStylePreset } from '@/lib/constants';

const TEMPLATE_ICONS: Record<string, string> = {
  'Forklift safety': '🚜',
  'Slip and trip hazards': '🚶',
  'PPE basics': '⛑️',
  'Fire evacuation': '🚒',
};

export function ScriptForm() {
  const {
    prompt,
    setPrompt,
    voice,
    setVoice,
    audience,
    setAudience,
    draftMode,
    setDraftMode,
    highQualityImages,
    setHighQualityImages,
    captions,
    setCaptions,
    visualStylePreset,
    setVisualStylePreset,
    safetyKeywords,
    setSafetyKeywords,
    handleGenerateScript,
    script,
    step,
  } = useVideoFlow();
  const { providerConfig } = useCostContext();
  const useVideo = providerConfig?.videoProvider === 'wan';
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [promptTouched, setPromptTouched] = useState(false);

  const isGenerating = step === 'script' && !script;
  const hasScript = !!script;
  const charCount = prompt.length;
  const nearLimit = charCount >= MAX_PROMPT_LENGTH * 0.9;
  const promptIsEmpty = !prompt.trim();
  const showPromptError = promptTouched && promptIsEmpty;

  const handleGenerateClick = () => {
    setPromptTouched(true);
    if (promptIsEmpty) return;
    handleGenerateScript();
  };

  return (
    <div className="space-y-5">
      <div>
        <label
          htmlFor="prompt-input"
          className="block text-sm font-medium text-[var(--foreground)] mb-2"
        >
          What kind of safety video do you want?
        </label>
        <textarea
          id="prompt-input"
          aria-describedby={`intro-desc prompt-count${showPromptError ? ' prompt-error' : ''}`}
          aria-invalid={showPromptError}
          maxLength={MAX_PROMPT_LENGTH}
          className="w-full h-32 px-4 py-3 border border-[var(--card-border)] rounded-card
            bg-[var(--card)] text-[var(--foreground)]
            placeholder:text-[var(--muted)]
            focus:ring-2 focus:ring-primary focus:border-transparent
            transition-colors duration-200 resize-none"
          placeholder="e.g. A 2-minute safety video about forklift safety in a warehouse, with tips on checking the horn and looking both ways."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onBlur={() => setPromptTouched(true)}
        />
        {showPromptError ? <p id="prompt-error" className="mt-2 text-xs text-red-600 dark:text-red-400" role="alert">
            Please enter a short description to generate a script.
          </p> : null}
        <div
          id="prompt-count"
          className={`mt-1 text-xs text-right tabular-nums ${
            nearLimit ? 'text-amber-600 dark:text-amber-400' : 'text-[var(--muted)]'
          }`}
        >
          {charCount} / {MAX_PROMPT_LENGTH}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-[var(--foreground)] mb-3">
          Quick templates
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {TEMPLATES.map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={() => {
                setPrompt(t.prompt);
                setPromptTouched(true);
              }}
              className="flex items-start gap-3 p-4 rounded-card border border-[var(--card-border)]
                bg-[var(--card)] text-left
                hover:border-primary hover:shadow-md
                focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2
                transition-all duration-200 group"
            >
              <span className="text-2xl shrink-0" aria-hidden>
                {TEMPLATE_ICONS[t.label] ?? '📋'}
              </span>
              <div className="min-w-0">
                <span className="font-medium text-[var(--foreground)] group-hover:text-primary transition-colors">
                  {t.label}
                </span>
                <p className="mt-0.5 text-xs text-[var(--muted)] line-clamp-2">
                  {t.prompt.slice(0, 80)}…
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={() => setOptionsOpen(!optionsOpen)}
          className="flex items-center justify-between w-full py-2 text-sm font-medium text-[var(--foreground)] hover:text-primary transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-md"
          aria-expanded={optionsOpen}
        >
          Options
          <span
            className={`transform transition-transform duration-200 ${
              optionsOpen ? 'rotate-180' : ''
            }`}
          >
            ▼
          </span>
        </button>
        {optionsOpen ? <Card padding="md" className="mt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
                <span className="text-[var(--muted)]">Visual style</span>
                <select
                  value={visualStylePreset}
                  onChange={(e) => setVisualStylePreset(e.target.value as VisualStylePreset)}
                  className="px-3 py-2 border border-[var(--card-border)] rounded-card
                    bg-[var(--card)] text-[var(--foreground)]
                    focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  {VISUAL_STYLE_PRESETS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
                <span className="text-[var(--muted)]">
                  Key safety concepts to highlight{' '}
                  <span className="text-xs">(optional)</span>
                </span>
                <input
                  type="text"
                  value={safetyKeywords}
                  onChange={(e) => setSafetyKeywords(e.target.value)}
                  placeholder="e.g. seatbelt, horn check, pedestrian awareness"
                  className="px-3 py-2 border border-[var(--card-border)] rounded-card
                    bg-[var(--card)] text-[var(--foreground)]
                    placeholder:text-[var(--muted)]
                    focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                <span className="text-xs text-[var(--muted)]">
                  Images will emphasize these safety topics in each scene
                </span>
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-[var(--muted)]">Audience</span>
                <select
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  className="px-3 py-2 border border-[var(--card-border)] rounded-card
                    bg-[var(--card)] text-[var(--foreground)]
                    focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  {AUDIENCES.map((a) => (
                    <option key={a.value || 'all'} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
                <span className="text-[var(--muted)]">
                  Voice
                  {prompt.trim() && (() => {
                    const recommended = getRecommendedVoice(prompt);
                    return recommended ? (
                      <button
                        type="button"
                        onClick={() => setVoice(recommended.value)}
                        className="ml-2 text-xs text-primary hover:underline"
                      >
                        Suggested: {recommended.label}
                      </button>
                    ) : null;
                  })()}
                </span>
                <select
                  value={voice}
                  onChange={(e) => setVoice(e.target.value)}
                  className="px-3 py-2 border border-[var(--card-border)] rounded-card
                    bg-[var(--card)] text-[var(--foreground)]
                    focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <optgroup label="Authoritative (serious topics)">
                    {VOICES.filter(v => v.category === 'authoritative').map((v) => (
                      <option key={v.value} value={v.value}>{v.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Professional (compliance/corporate)">
                    {VOICES.filter(v => v.category === 'professional').map((v) => (
                      <option key={v.value} value={v.value}>{v.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Friendly (general awareness)">
                    {VOICES.filter(v => v.category === 'friendly').map((v) => (
                      <option key={v.value} value={v.value}>{v.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Warm (sensitive topics)">
                    {VOICES.filter(v => v.category === 'warm').map((v) => (
                      <option key={v.value} value={v.value}>{v.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Energetic (engaging content)">
                    {VOICES.filter(v => v.category === 'energetic').map((v) => (
                      <option key={v.value} value={v.value}>{v.label}</option>
                    ))}
                  </optgroup>
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm text-[var(--foreground)] sm:col-span-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draftMode}
                  onChange={(e) => setDraftMode(e.target.checked)}
                  className="rounded border-[var(--card-border)] text-primary focus:ring-primary"
                />
                Draft mode (lower cost, 3 scenes)
              </label>
              {!useVideo && (
                <label className="flex items-center gap-2 text-sm text-[var(--foreground)] sm:col-span-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={highQualityImages}
                    onChange={(e) => setHighQualityImages(e.target.checked)}
                    className="rounded border-[var(--card-border)] text-primary focus:ring-primary"
                  />
                  High-quality images (HD, higher cost)
                </label>
              )}
              <label className="flex items-center gap-2 text-sm text-[var(--foreground)] sm:col-span-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={captions}
                  onChange={(e) => setCaptions(e.target.checked)}
                  className="rounded border-[var(--card-border)] text-primary focus:ring-primary"
                />
                <span>
                  <strong>Closed captions</strong> (burn narration into the video)
                </span>
              </label>
            </div>
          </Card> : null}
      </div>

      <Button
        onClick={handleGenerateClick}
        disabled={promptIsEmpty || (isGenerating && !hasScript)}
        aria-busy={isGenerating ? !hasScript : null}
        fullWidth
        size="lg"
        isLoading={isGenerating ? !hasScript : null}
      >
        {isGenerating && !hasScript ? 'Generating script…' : 'Generate script'}
      </Button>
      <p className="sr-only" aria-live="polite">
        {isGenerating && !hasScript ? 'Generating script.' : ''}
      </p>
      <p className="text-xs text-[var(--muted)] text-center">
        <kbd className="px-1.5 py-0.5 bg-[var(--card-border)] rounded text-[var(--foreground)]">
          ⌘
        </kbd>
        +
        <kbd className="px-1.5 py-0.5 bg-[var(--card-border)] rounded text-[var(--foreground)]">
          Enter
        </kbd>
        to generate
      </p>
    </div>
  );
}
