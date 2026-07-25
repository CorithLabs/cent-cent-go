import React, { useState, useEffect } from 'react';
import { useELI5, ELI5Response, ELI5Section } from '../../hooks/useELI5';
import {
  isChromeAIAvailable,
  generateELI5Narrative,
  sentimentBadge,
} from '../../utils/chromeAI';
import './ELI5Panel.css';

interface ELI5PanelProps {
  ticker: string;
}

/**
 * ELI5Panel — "How is this stock doing? (ELI5)" section on Stock Detail page.
 *
 * AC: Calls GET /api/stocks/:ticker/eli5 for structured analysis object.
 * AC: Uses window.ai.languageModel to generate plain-English narratives.
 * AC: Falls back to structured labels if window.ai is unavailable.
 * AC: Each section card: emoji, AI narrative or label, expandable detail.
 * AC: Headline sentiment badge (icon + label, never color alone) — WCAG compliant.
 * AC: "data as of [date]" note and "What do these mean?" link.
 * AC: Hides cards for which no data is available.
 * AC: window.ai failure per-section falls back gracefully — never blank.
 */
export const ELI5Panel: React.FC<ELI5PanelProps> = ({ ticker }) => {
  const { data, isLoading, error, notFound } = useELI5(ticker);
  const [narratives, setNarratives] = useState<Record<string, string>>({});
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const aiAvailable = isChromeAIAvailable();

  // Generate AI narratives once backend data arrives
  useEffect(() => {
    if (!data || !aiAvailable) return;

    let cancelled = false;

    const generateAll = async () => {
      for (const section of data.sections) {
        if (cancelled) break;
        const narrative = await generateELI5Narrative(section);
        if (!cancelled && narrative) {
          setNarratives((prev) => ({ ...prev, [section.topic]: narrative }));
        }
      }
    };

    generateAll();
    return () => { cancelled = true; };
  }, [data, aiAvailable]);

  const toggleExpand = (topic: string) => {
    setExpandedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(topic)) {
        next.delete(topic);
      } else {
        next.add(topic);
      }
      return next;
    });
  };

  // ── Render states ────────────────────────────────────────────────────────

  if (notFound) return null; // don't show panel for unknown tickers

  if (isLoading) {
    return (
      <div className="eli5-panel eli5-panel--loading" aria-busy="true" aria-label="Loading ELI5 summary">
        <div className="eli5-panel__skeleton" />
        <div className="eli5-panel__skeleton eli5-panel__skeleton--short" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="eli5-panel eli5-panel--error" role="status">
        <p>ELI5 summary unavailable.</p>
      </div>
    );
  }

  const badge = sentimentBadge(data.overallSentiment);
  const hasLimitedData = data.sections.length === 0;

  return (
    <section className="eli5-panel" aria-labelledby="eli5-heading">
      {/* Header */}
      <div className="eli5-panel__header">
        <h2 id="eli5-heading" className="eli5-panel__title">
          How is this stock doing? <span className="eli5-panel__subtitle">(ELI5)</span>
        </h2>

        {/* Sentiment badge — icon + label, WCAG compliant */}
        <div
          className={`eli5-panel__badge ${badge.className}`}
          aria-label={`Overall sentiment: ${badge.label}`}
          role="status"
        >
          <span aria-hidden="true">{badge.icon}</span>
          <span>{badge.label}</span>
        </div>
      </div>

      {/* Chrome AI upgrade notice */}
      {!aiAvailable && (
        <p className="eli5-panel__ai-notice" role="note">
          Upgrade to Chrome 127+ for full ELI5 explanations powered by on-device AI.
        </p>
      )}

      {/* Limited data notice */}
      {hasLimitedData && (
        <div className="eli5-panel__limited" role="status">
          <span>📊</span>
          <p>Limited data available for this stock. Not enough metrics to provide a full ELI5 summary.</p>
        </div>
      )}

      {/* Section cards */}
      {!hasLimitedData && (
        <div className="eli5-panel__sections" aria-label="ELI5 section cards">
          {data.sections.map((section: ELI5Section) => {
            const narrative = narratives[section.topic];
            const isExpanded = expandedTopics.has(section.topic);

            // Fallback label when no AI narrative available
            const displayText = narrative ?? formatFallbackLabel(section);

            return (
              <div key={section.topic} className="eli5-panel__card">
                <div className="eli5-panel__card-header">
                  <span className="eli5-panel__emoji" aria-hidden="true">{section.emoji}</span>
                  <div className="eli5-panel__card-content">
                    <p className="eli5-panel__topic">{section.topic}</p>
                    <p className="eli5-panel__narrative">{displayText}</p>
                  </div>
                  <button
                    className="eli5-panel__expand-btn"
                    onClick={() => toggleExpand(section.topic)}
                    aria-expanded={isExpanded}
                    aria-controls={`eli5-detail-${section.topic}`}
                    aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${section.topic} detail`}
                  >
                    {isExpanded ? '▲' : '▼'}
                  </button>
                </div>

                {isExpanded && (
                  <div
                    id={`eli5-detail-${section.topic}`}
                    className="eli5-panel__detail"
                    aria-live="polite"
                  >
                    <dl>
                      <div>
                        <dt>Value</dt>
                        <dd>{section.rawValue}</dd>
                      </div>
                      {section.sectorBenchmark && (
                        <div>
                          <dt>Sector benchmark</dt>
                          <dd>
                            {section.sectorBenchmark}
                            {section.sectorBenchmarkUnavailable && (
                              <span className="eli5-panel__benchmark-note"> (using absolute thresholds)</span>
                            )}
                          </dd>
                        </div>
                      )}
                    </dl>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <div className="eli5-panel__footer">
        <p className="eli5-panel__data-as-of">
          Data as of{' '}
          <time dateTime={data.dataAsOf}>
            {new Date(data.dataAsOf).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </time>
        </p>
        <a href="/learn" className="eli5-panel__learn-link">
          What do these mean? →
        </a>
      </div>
    </section>
  );
};

/**
 * Formats a human-readable fallback label when window.ai is unavailable.
 * e.g. label: 'pricey' → "Valuation: Pricey"
 */
function formatFallbackLabel(section: ELI5Section): string {
  const readable = section.label
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return `${section.topic}: ${readable}`;
}

export default ELI5Panel;
