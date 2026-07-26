import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useLearnList } from '../hooks/useLearnList';
import './LearnPage.css';

/**
 * LearnPage — /learn
 *
 * AC: Shows a grid of concept cards with title, summary, tags, and estimated read time.
 * AC: Cards filterable by tag.
 * AC: Clicking a card navigates to /learn/:slug.
 */
const LearnPage: React.FC = () => {
  const { data, isLoading, error } = useLearnList();
  const [activeTag, setActiveTag] = useState<string | null>(null);

  // Collect all unique tags from articles
  const allTags = useMemo(() => {
    if (!data) return [];
    const tagSet = new Set<string>();
    for (const article of data.articles) {
      for (const tag of article.tags) {
        tagSet.add(tag);
      }
    }
    return Array.from(tagSet).sort();
  }, [data]);

  // Filter articles by active tag
  const filteredArticles = useMemo(() => {
    if (!data) return [];
    if (!activeTag) return data.articles;
    return data.articles.filter((a) => a.tags.includes(activeTag));
  }, [data, activeTag]);

  return (
    <main className="learn-page">
      <header className="learn-page__header">
        <h1 className="learn-page__title">Learn — Concept Explainers</h1>
        <p className="learn-page__subtitle">
          ByteByteGo-style visual explainers for financial and economic concepts.
          Clear diagrams, analogies, and layered depth.
        </p>
      </header>

      {/* Tag filter */}
      {!isLoading && !error && allTags.length > 0 && (
        <div
          className="learn-page__tags"
          role="group"
          aria-label="Filter articles by topic"
        >
          <button
            className={`learn-page__tag-btn${activeTag === null ? ' learn-page__tag-btn--active' : ''}`}
            onClick={() => setActiveTag(null)}
            aria-pressed={activeTag === null}
          >
            All
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              className={`learn-page__tag-btn${activeTag === tag ? ' learn-page__tag-btn--active' : ''}`}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              aria-pressed={activeTag === tag}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="learn-page__grid" aria-label="Loading articles" aria-busy="true">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="learn-card learn-card--skeleton" aria-hidden="true" />
          ))}
        </div>
      )}

      {/* Error */}
      {error && !isLoading && (
        <p className="learn-page__error" role="alert">{error}</p>
      )}

      {/* Article cards grid */}
      {!isLoading && !error && (
        <>
          {filteredArticles.length === 0 ? (
            <p className="learn-page__empty">
              No articles found for this topic.{' '}
              <button
                className="learn-page__clear-filter"
                onClick={() => setActiveTag(null)}
              >
                Show all articles
              </button>
            </p>
          ) : (
            <div
              className="learn-page__grid"
              aria-label={
                activeTag
                  ? `Concept articles tagged with "${activeTag}"`
                  : 'All concept articles'
              }
            >
              {filteredArticles.map((article) => (
                <Link
                  key={article.slug}
                  to={`/learn/${article.slug}`}
                  className="learn-card"
                  aria-label={`${article.title} — ${article.readTime}`}
                >
                  <div className="learn-card__tags">
                    {article.tags.map((tag) => (
                      <span key={tag} className="learn-card__tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <h2 className="learn-card__title">{article.title}</h2>
                  <p className="learn-card__summary">{article.summary}</p>
                  <footer className="learn-card__footer">
                    <span className="learn-card__read-time">
                      🕐 {article.readTime}
                    </span>
                    <span className="learn-card__cta">Read →</span>
                  </footer>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
};

export default LearnPage;
