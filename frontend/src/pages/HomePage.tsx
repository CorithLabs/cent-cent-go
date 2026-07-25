import React from 'react';
import { SearchBar } from '../components/SearchBar/SearchBar';

/**
 * HomePage — root route /.
 * Shows a hero search bar. Individual investors can search for any stock.
 */
const HomePage: React.FC = () => {
  return (
    <div className="home-page">
      <section className="home-page__hero" aria-labelledby="hero-heading">
        <h1 id="hero-heading" className="home-page__title">
          Understand any stock — <span className="home-page__highlight">in plain English</span>
        </h1>
        <p className="home-page__subtitle">
          Search for a stock to see price charts, fundamentals, and a plain-English ELI5 summary.
        </p>

        <div className="home-page__search">
          <SearchBar variant="hero" placeholder="Search ticker or company name…" />
        </div>

        <p className="home-page__disclaimer" role="note">
          Data is for informational purposes only and does not constitute financial advice.
        </p>
      </section>
    </div>
  );
};

export default HomePage;
