import { ELI5Section } from '../hooks/useELI5';

const ELI5_SYSTEM_PROMPT =
  'You are a financial educator explaining stock metrics to a non-expert in a single friendly sentence. Keep it under 25 words. Do not use jargon. Use plain English.';

/**
 * Locates Chrome's built-in on-device language model across API generations:
 *   - Chrome 138+ standardized global:  self.LanguageModel  (LanguageModel.create)
 *   - Chrome 127–137 origin-trial shape: window.ai.languageModel
 * Returns the handle plus whether it's the legacy shape (different create options).
 */
function getLanguageModel(): { model: any; legacy: boolean } | null {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  if (typeof w.LanguageModel?.create === 'function') {
    return { model: w.LanguageModel, legacy: false };
  }
  if (typeof w.ai?.languageModel?.create === 'function') {
    return { model: w.ai.languageModel, legacy: true };
  }
  return null;
}

/**
 * Returns true if Chrome's built-in AI (Prompt API) is present in this browser.
 * Note: presence does not guarantee the model is downloaded — create() may still
 * fail or trigger a download, in which case the caller falls back to labels.
 */
export function isChromeAIAvailable(): boolean {
  return getLanguageModel() !== null;
}

/**
 * Generates a friendly one-sentence plain-English narrative for an ELI5 section
 * using Chrome's built-in AI.
 *
 * Returns null if the API is unavailable or generation fails.
 * The component falls back to displaying the raw structured label.
 *
 * AC: Never leaves a section blank — always falls back to label.
 * AC: Session failure per-section is caught; only that section degrades.
 */
export async function generateELI5Narrative(section: ELI5Section): Promise<string | null> {
  const found = getLanguageModel();
  if (!found) return null;

  try {
    // The standardized API takes initialPrompts with roles; the legacy origin-trial
    // shape took a flat systemPrompt.
    const session = await found.model.create(
      found.legacy
        ? { systemPrompt: ELI5_SYSTEM_PROMPT }
        : { initialPrompts: [{ role: 'system', content: ELI5_SYSTEM_PROMPT }] },
    );

    const result = await session.prompt(buildPrompt(section));

    // Free the session (method name is stable across generations).
    session.destroy?.();

    const text = typeof result === 'string' ? result.trim() : '';
    if (!text || text.length < 5) return null;
    return text;
  } catch (err) {
    console.warn(`[chrome-ai] Failed to generate narrative for ${section.topic}:`, err);
    return null;
  }
}

/**
 * Builds the prompt for window.ai based on the section data.
 */
function buildPrompt(section: ELI5Section): string {
  const benchmarkNote = section.sectorBenchmark
    ? ` The sector average is ${section.sectorBenchmark}.`
    : '';
  return `Explain this in one simple sentence for a beginner investor: ${section.topic} is ${section.label} (${section.rawValue}).${benchmarkNote}`;
}

/**
 * Maps overall sentiment to an emoji + text for the headline badge.
 * AC: Sentiment badge must pass WCAG contrast — uses icon + label, never color alone.
 */
export function sentimentBadge(sentiment: string): { icon: string; label: string; className: string } {
  switch (sentiment) {
    case 'positive':
      return { icon: '🟢', label: 'Doing well overall', className: 'eli5__badge--positive' };
    case 'neutral':
      return { icon: '🟡', label: 'Mixed signals', className: 'eli5__badge--neutral' };
    case 'caution':
      return { icon: '🟠', label: 'Some concerns', className: 'eli5__badge--caution' };
    case 'negative':
      return { icon: '🔴', label: 'Needs attention', className: 'eli5__badge--negative' };
    default:
      return { icon: '⚪', label: 'Unknown', className: 'eli5__badge--neutral' };
  }
}
