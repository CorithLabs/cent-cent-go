import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { SearchBar } from '../SearchBar/SearchBar';
import './TopNav.css';

/**
 * TopNav — fixed navigation bar present on all pages.
 * Contains the app logo, SearchBar (nav variant), and primary page links.
 */
export const TopNav: React.FC = () => {
  return (
    <nav className="top-nav" aria-label="Main navigation">
      <div className="top-nav__inner">
        {/* Logo */}
        <Link to="/" className="top-nav__logo" aria-label="Cent Cent Go — Home">
          <span className="top-nav__logo-mark">¢¢</span>
          <span className="top-nav__logo-text">cent-cent-go</span>
        </Link>

        {/* Search — always visible in nav */}
        <div className="top-nav__search">
          <SearchBar variant="nav" placeholder="Search ticker or company…" />
        </div>

        {/* Primary links */}
        <ul className="top-nav__links" role="list">
          <li>
            <NavLink
              to="/economics"
              className={({ isActive }) =>
                `top-nav__link${isActive ? ' top-nav__link--active' : ''}`
              }
            >
              Economics
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/sectors"
              className={({ isActive }) =>
                `top-nav__link${isActive ? ' top-nav__link--active' : ''}`
              }
            >
              Sectors
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/compare"
              className={({ isActive }) =>
                `top-nav__link${isActive ? ' top-nav__link--active' : ''}`
              }
            >
              Compare
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/learn"
              className={({ isActive }) =>
                `top-nav__link${isActive ? ' top-nav__link--active' : ''}`
              }
            >
              Learn
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/watchlist"
              className={({ isActive }) =>
                `top-nav__link${isActive ? ' top-nav__link--active' : ''}`
              }
            >
              Watchlist
            </NavLink>
          </li>
        </ul>
      </div>
    </nav>
  );
};
