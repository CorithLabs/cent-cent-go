import { useState, useEffect } from 'react';

export interface LearnSection {
  heading: string;
  body: string;
  diagramUrl?: string;
}

export interface LearnArticle {
  slug: string;
  title: string;
  summary: string;
  sections: LearnSection[];
  relatedSlugs: string[];
  tags: string[];
  readTime: string;
}

interface UseLearnArticleReturn {
  data: LearnArticle | null;
  isLoading: boolean;
  error: string | null;
  notFound: boolean;
}

/**
 * Fetches a single concept article by slug from GET /api/learn/:slug.
 * Shared between LearnArticlePage and the ConceptSlideOver panel.
 * Follows the same hook pattern as useStockQuote.ts.
 */
export function useLearnArticle(slug: string): UseLearnArticleReturn {
  const [data, setData] = useState<LearnArticle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setNotFound(false);
    setData(null);

    const fetchData = async () => {
      try {
        const res = await fetch(`/api/learn/${encodeURIComponent(slug)}`);

        if (res.status === 404) {
          if (!cancelled) setNotFound(true);
          return;
        }

        if (!res.ok) {
          throw new Error(`Server returned ${res.status}`);
        }

        const json: LearnArticle = await res.json();
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError('Failed to load article. Please try again.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [slug]);

  return { data, isLoading, error, notFound };
}
