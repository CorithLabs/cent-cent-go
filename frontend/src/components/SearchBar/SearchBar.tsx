import React, { useRef, useEffect, useCallback, KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSearch } from '../../hooks/useSearch';
import './SearchBar.css';

interface SearchBarProps {
  /** Additional CSS class for layout context (e.g. 'hero' on home, 'nav' in top bar) */
  variant?: 'hero' | 'nav';
  placeholder?: string;
}

/**
 * SearchBar — typeahead search with 300ms debounce.
 * AC: Visible on home and top nav. Debounced at 300ms. Loading spinner.
 * AC: Shows up to 10 results. Escape closes dropdown.
 */
export const SearchBar: React.FC<SearchBarProps> = ({
  variant = 'nav',
  placeholder = 'Search ticker or company…',
}) => {
  const navigate = useNavigate();
  const { results, isLoading, error, query, setQuery, clearResults } = useSearch();
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLUListElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const isOpen = query.trim().length > 0 && (isLoading || results.length > 0 || !!error);

  // Close dropdown on Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        setQuery('');
        clearResults();
        inputRef.current?.blur();
      }
    },
    [setQuery, clearResults]
  );

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        clearResults();
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [clearResults, setQuery]);

  const handleSelect = useCallback(
    (ticker: string) => {
      setQuery('');
      clearResults();
      navigate(`/stock/${ticker.toUpperCase()}`);
    },
    [navigate, setQuery, clearResults]
  );

  return (
    <div
      ref={containerRef}
      className={`search-bar search-bar--${variant}`}
      role="search"
      aria-label="Search for a stock"
    >
      <div className="search-bar__input-wrapper">
        <svg
          className="search-bar__icon"
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="currentColor"
          width={18}
          height={18}
        >
          <path
            fillRule="evenodd"
            d="M9 3a6 6 0 100 12A6 6 0 009 3zM1 9a8 8 0 1114.32 4.906l3.387 3.387a1 1 0 01-1.414 1.414l-3.387-3.387A8 8 0 011 9z"
            clipRule="evenodd"
          />
        </svg>

        <input
          ref={inputRef}
          type="search"
          className="search-bar__input"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          spellCheck={false}
          aria-autocomplete="list"
          aria-controls={isOpen ? 'search-results' : undefined}
          aria-expanded={isOpen}
          aria-label="Search for a stock by ticker or company name"
        />

        {isLoading && (
          <div className="search-bar__spinner" aria-label="Loading search results" role="status">
            <div className="spinner" />
          </div>
        )}
      </div>

      {isOpen && (
        <ul
          id="search-results"
          ref={dropdownRef}
          className="search-bar__dropdown"
          role="listbox"
          aria-label="Search results"
        >
          {error && (
            <li className="search-bar__error" role="alert">
              {error}
            </li>
          )}

          {!error && results.length === 0 && !isLoading && (
            <li className="search-bar__no-results">No results found</li>
          )}

          {!error &&
            results.slice(0, 10).map((result) => (
              <li
                key={result.ticker}
                className="search-bar__result"
                role="option"
                aria-selected={false}
                onClick={() => handleSelect(result.ticker)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSelect(result.ticker);
                }}
                tabIndex={0}
              >
                <span className="search-bar__result-ticker">{result.ticker}</span>
                <span className="search-bar__result-name">{result.name}</span>
                <span className="search-bar__result-exchange">{result.exchange}</span>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
};

export default SearchBar;
