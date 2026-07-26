import React, { useState, Suspense, lazy } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useLearnArticle } from '../hooks/useLearnArticle';
import './LearnArticlePage.css';

// Lazy load Mermaid renderer for diagrams
const DiagramRenderer = lazy(() => import('../components/DiagramRenderer/DiagramRenderer'));

// ── Depth label for each section (Basic, Intermediate, Advanced) ──────────────

const DEPTH_LABELS = ['Basic', 'Intermediate', 'Advanced'];

function getDepthLabel(index: number): string {
  return DEPTH_LABELS[index] ?? `Level ${index + 1}`;
}

// ── Slug to human-readable name ───────────────────────────────────────────────

function slugToName(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ── Inline HTML section body renderer ────────────────────────────────────────

const SectionBody: React.FC<{ html: string; diagramUrl?: string }> = ({ html, diagramUrl }) => {
  const [showTextOnly, setShowTextOnly] = useState(false);

  return (
    <div className="article-section__body">
      {/* Section body HTML from goldmark */}
      <div
        className="article-section__content"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {/* Inline diagram (lazy-loaded) */}
      {diagramUrl && (
        <div className="article-section__diagram">
          {showTextOnly ? (
            <div className="article-section__diagram-text">
              <p className="text-muted">Diagram: {diagramUrl}</p>
            </div>
          ) : (
            <Suspense fallback={<div className="article-section__diagram-loading" />}>
              <DiagramRenderer
                src={diagramUrl}
                alt={`Diagram for this section`}
                onTextOnlyToggle={() => setShowTextOnly(true)}
              />
            </Suspense>
          )}
          <button
            className="article-section__diagram-toggle"
            onClick={() => setShowTextOnly((v) => !v)}
            aria-label={showTextOnly ? 'Show diagram' : 'Switch to text-only view'}
          >
            {showTextOnly ? 'Show diagram' : 'Text only'}
          </button>
        </div>
      )}
    </div>
  );
};

// ── Page ──────────────────────────────────────────────────────────────────────

/**
 * LearnArticlePage — /learn/:slug
 *
 * AC: Renders article with title, summary, progressive depth sections (Basic → Intermediate → Advanced).
 * AC: Content sourced from markdown files via GET /api/learn/:slug.
 * AC: Related Concepts sidebar.
 * AC: Breadcrumb trail (Home → Learn → Article).
 * AC: Inline diagrams lazy-loaded with alt text and text-only fallback.
 * AC: 404 page with 'Browse all concepts' CTA.
 */
const LearnArticlePage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading, error, notFound } = useLearnArticle(slug ?? '');

  if (notFound) {
    return (
      <main className="learn-article learn-article--notfound">
        <h1>Article not found</h1>
        <p>We couldn't find an article for <code>{slug}</code>.</p>
        <Link to="/learn" className="learn-article__browse-cta">
          ← Browse all concepts
        </Link>
      </main>
    );
  }

  return (
    <main className="learn-article">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="learn-article__breadcrumb">
        <Link to="/">Home</Link>
        {' › '}
        <Link to="/learn">Learn</Link>
        {' › '}
        <span>{data?.title ?? slug}</span>
      </nav>

      {/* Loading state */}
      {isLoading && (
        <div className="learn-article__skeleton" aria-busy="true" aria-label="Loading article" />
      )}

      {error && !isLoading && (
        <p className="learn-article__error" role="alert">{error}</p>
      )}

      {data && !isLoading && (
        <div className="learn-article__layout">
          {/* Main content */}
          <article className="learn-article__content">
            {/* Header */}
            <header className="learn-article__header">
              <div className="learn-article__meta">
                {data.tags.map((tag) => (
                  <span key={tag} className="learn-article__tag">{tag}</span>
                ))}
                <span className="learn-article__read-time">🕐 {data.readTime}</span>
              </div>
              <h1 className="learn-article__title">{data.title}</h1>
              <p className="learn-article__summary">{data.summary}</p>
            </header>

            {/* Progressive depth sections */}
            {data.sections.map((section, index) => (
              <section
                key={index}
                className="article-section"
                aria-label={`${getDepthLabel(index)}: ${section.heading}`}
              >
                <div className="article-section__depth-label">
                  {getDepthLabel(index)}
                </div>
                <h2 className="article-section__heading">{section.heading}</h2>
                <SectionBody html={section.body} diagramUrl={section.diagramUrl} />
              </section>
            ))}
          </article>

          {/* Sidebar */}
          {data.relatedSlugs.length > 0 && (
            <aside className="learn-article__sidebar" aria-label="Related concepts">
              <h2 className="learn-article__sidebar-title">Related Concepts</h2>
              <ul className="learn-article__related-list">
                {data.relatedSlugs.map((relSlug) => (
                  <li key={relSlug}>
                    <Link
                      to={`/learn/${relSlug}`}
                      className="learn-article__related-link"
                    >
                      {slugToName(relSlug)} →
                    </Link>
                  </li>
                ))}
              </ul>
            </aside>
          )}
        </div>
      )}

      <p className="learn-article__disclaimer">
        Content is for educational and informational purposes only and does not
        constitute financial advice.
      </p>
    </main>
  );
};

export default LearnArticlePage;
