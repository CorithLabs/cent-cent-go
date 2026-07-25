import { ELI5Section } from '../hooks/useELI5';

/**
 * Returns true if Chrome Built-in AI (window.ai) is available in this browser.
 * Requires Chrome 127+ with the Origin Trial token set in <meta>.
 */
export function isChromeAIAvailable(): boolean {
  return typeof window !== 'undefined' && 'ai' in window && typeof (window as any).ai?.languageModel?.create === 'function';
}

/**
 * Generates a friendly one-sentence plain-English narrative for an ELI5 section
 * using Chrome Built-in AI (window.ai.languageModel).
 *
 * Returns null if window.ai is unavailable or if generation fails.
 * The component falls back to displaying the raw structured label.
 *
 * AC: Never leaves a section blank — always falls back to label.
 * AC: window.ai session failure per-section is caught; only that section degrades.
 */
export async function generateELI5Narrative(section: ELI5Section): Promise<string | null> {
  if (!isChromeAIAvailable()) return null;

  const ai = (window as any).ai;

  try {
    const session = await ai.languageModel.create({
      systemPrompt:
        'You are a financial educator explaining stock metrics to a non-expert in a single friendly sentence. Keep it under 25 words. Do not use jargon. Use plain English.',
    });

    const prompt = buildPrompt(section);
    const result = await session.prompt(prompt);

    // Destroy session to free memory
    session.destroy();

    const text = result?.trim();
    if (!text || text.length < 5) return null;
    return text;
  } catch (err) {
    console.warn(`[window.ai] Failed to generate narrative for ${section.topic}:`, err);
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
