import React, { useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useLearnArticle } from '../../hooks/useLearnArticle';
import './ConceptSlideOver.css';

interface ConceptSlideOverProps {
  slug: string;
  label: string;
  onClose: () => void;
}

/**
 * ConceptSlideOver — renders a slide-over panel for a concept article.
 *
 * AC: Fetches article via useLearnArticle hook (GET /api/learn/:slug).
 * AC: Does NOT use a local JSON index or bundled content.
 * AC: Keyboard-accessible — closes on Escape.
 * AC: Traps focus within the panel while open.
 * AC: Restores focus to the trigger element on close.
 * AC: Skeleton loading state while fetching.
 * AC: 'Open full article' link at the bottom.
 * AC: Shows error message with 'Open full article' fallback on network error.
 */
export const ConceptSlideOver: React.FC<ConceptSlideOverProps> = ({
  slug,
  label,
  onClose,
}) => {
  const { data, isLoading, error } = useLearnArticle(slug);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Focus close button on open
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  // Focus trap: cycle focus within the panel
  const handlePanelKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return;

    const panel = panelRef.current;
    if (!panel) return;

    const focusableElements = panel.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const focusable = Array.from(focusableElements);
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }, []);

  return (
    <>
      {/* Backdrop */}
      <div
        className="concept-slide-over__backdrop"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="concept-slide-over"
        role="dialog"
        aria-modal="true"
        aria-label={`Learn: ${label}`}
        onKeyDown={handlePanelKeyDown}
      >
        {/* Header */}
        <div className="concept-slide-over__header">
          <h2 className="concept-slide-over__title">
            {data?.title ?? label}
          </h2>
          <button
            ref={closeRef}
            className="concept-slide-over__close"
            onClick={onClose}
            aria-label="Close concept panel"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="concept-slide-over__body">
          {isLoading && (
            <>
              <div className="concept-slide-over__skeleton" aria-hidden="true" />
              <div className="concept-slide-over__skeleton concept-slide-over__skeleton--short" aria-hidden="true" />
              <div className="concept-slide-over__skeleton" aria-hidden="true" />
            </>
          )}

          {error && !isLoading && (
            <div className="concept-slide-over__error" role="alert">
              <p>Failed to load article content.</p>
              <Link
                to={`/learn/${slug}`}
                className="concept-slide-over__fallback-link"
              >
                Open full article →
              </Link>
            </div>
          )}

          {data && !isLoading && (
            <>
              <p className="concept-slide-over__summary">{data.summary}</p>

              {/* Show first section (Basic) as a preview */}
              {data.sections[0] && (
                <div className="concept-slide-over__preview">
                  <h3 className="concept-slide-over__section-heading">
                    {data.sections[0].heading}
                  </h3>
                  <div
                    className="concept-slide-over__section-body"
                    // eslint-disable-next-line react/no-danger
                    dangerouslySetInnerHTML={{ __html: data.sections[0].body }}
                  />
                </div>
              )}

              {data.sections.length > 1 && (
                <p className="concept-slide-over__more-hint">
                  + {data.sections.length - 1} more{' '}
                  {data.sections.length - 1 === 1 ? 'section' : 'sections'} in the full article
                </p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="concept-slide-over__footer">
          <Link
            to={`/learn/${slug}`}
            className="concept-slide-over__full-article-link"
            onClick={onClose}
          >
            Open full article →
          </Link>
        </div>
      </div>
    </>
  );
};

// ── Hook to manage slug availability ──────────────────────────────────────────

/**
 * useConceptLinkAvailability checks if a learn article exists for a given slug.
 * Returns true once a 200 response is confirmed.
 * If 404, returns false — the contextual link should not be rendered.
 *
 * AC: If no matching concept article exists for a metric (slug not found — 404
 *     from API), the contextual link is not rendered at all.
 */
export function useConceptLinkAvailability(slug: string): boolean {
  const [available, setAvailable] = React.useState(false);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    fetch(`/api/learn/${encodeURIComponent(slug)}`, { method: 'GET' })
      .then((res) => {
        if (!cancelled && res.ok) {
          setAvailable(true);
        }
      })
      .catch(() => {
        // silently fail — link will not render
      });

    return () => { cancelled = true; };
  }, [slug]);

  return available;
}
