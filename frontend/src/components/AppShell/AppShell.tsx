import React, { useRef } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { SearchBar } from '../SearchBar/SearchBar';
import './AppShell.css';

// SVG icon components — 24×24 viewBox
const IconHome = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);

const IconWatchlist = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
  </svg>
);

const IconEconomics = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
  </svg>
);

const IconCompare = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/>
    <polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/>
  </svg>
);

const IconSectors = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
    <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
  </svg>
);

const IconLearn = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
  </svg>
);

const IconSearch = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);

interface NavItem {
  to: string;
  label: string;
  Icon: React.FC;
  end?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/',           label: 'Home',       Icon: IconHome,      end: true },
  { to: '/watchlist',  label: 'Watchlist',  Icon: IconWatchlist  },
  { to: '/economics',  label: 'Economics',  Icon: IconEconomics  },
  { to: '/compare',    label: 'Compare',    Icon: IconCompare    },
  { to: '/sectors',    label: 'Sectors',    Icon: IconSectors    },
  { to: '/learn',      label: 'Learn',      Icon: IconLearn      },
];

// Bottom nav only shows 5 tabs (no Compare on mobile)
const BOTTOM_NAV_ITEMS: NavItem[] = [
  { to: '/',          label: 'Home',      Icon: IconHome,     end: true },
  { to: '/watchlist', label: 'Watchlist', Icon: IconWatchlist },
  { to: '/economics', label: 'Economics', Icon: IconEconomics },
  { to: '/sectors',   label: 'Sectors',   Icon: IconSectors   },
  { to: '/learn',     label: 'Learn',     Icon: IconLearn     },
];

interface AppShellProps {
  children: React.ReactNode;
}

/**
 * AppShell — persistent layout wrapper for all routes.
 *
 * Desktop (>=1024px): fixed 240px left sidebar with logo, SearchBar, nav links.
 * Mobile (<1024px): fixed bottom nav (5 tabs) + floating search button.
 *
 * AC: Active route highlighted with --color-accent left border + accent-dim bg.
 * AC: Sidebar does not scroll — only the main content area scrolls.
 * AC: Logo is a home link with accessible label.
 * AC: All existing routes continue to work — AppShell wraps <Routes>.
 */
export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const [mobileSearchOpen, setMobileSearchOpen] = React.useState(false);
  const searchTriggerRef = useRef<HTMLButtonElement>(null);

  const openMobileSearch = () => setMobileSearchOpen(true);
  const closeMobileSearch = () => {
    setMobileSearchOpen(false);
    // Return focus to trigger button
    setTimeout(() => searchTriggerRef.current?.focus(), 50);
  };

  // Close mobile search on Escape
  React.useEffect(() => {
    if (!mobileSearchOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMobileSearch();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [mobileSearchOpen]);

  return (
    <div className="app-shell">
      {/* ── Desktop Sidebar ──────────────────────────────────────────────── */}
      <aside className="app-shell__sidebar" aria-label="Main navigation">
        {/* Logo */}
        <Link to="/" className="app-shell__logo" aria-label="cent-cent-go — Home">
          <span className="app-shell__logo-mark" aria-hidden="true">¢¢</span>
          <span className="app-shell__logo-text">cent-cent-go</span>
        </Link>

        {/* Embedded search */}
        <div className="app-shell__search">
          <SearchBar variant="nav" placeholder="Search ticker or company…" />
        </div>

        {/* Nav links */}
        <nav className="app-shell__nav" aria-label="Main navigation">
          <ul role="list" className="app-shell__nav-list">
            {NAV_ITEMS.map(({ to, label, Icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `app-shell__nav-link${isActive ? ' app-shell__nav-link--active' : ''}`
                  }
                  aria-current={undefined}
                >
                  {({ isActive }) => (
                    <>
                      <span className="app-shell__nav-icon" aria-hidden="true">
                        <Icon />
                      </span>
                      <span className="app-shell__nav-label">{label}</span>
                      {isActive && <span className="sr-only"> (current page)</span>}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Disclaimer */}
        <p className="app-shell__disclaimer">
          Data for informational purposes only. Not financial advice.
        </p>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main className="app-shell__main" id="main-content">
        {children}
      </main>

      {/* ── Mobile bottom navigation ─────────────────────────────────────── */}
      <nav className="app-shell__bottom-nav" aria-label="Main navigation">
        {BOTTOM_NAV_ITEMS.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `app-shell__bottom-tab${isActive ? ' app-shell__bottom-tab--active' : ''}`
            }
          >
            {({ isActive }) => (
              <>
                <span className="app-shell__bottom-icon" aria-hidden="true">
                  <Icon />
                </span>
                <span className="app-shell__bottom-label">{label}</span>
                {isActive && <span className="sr-only"> (current page)</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* ── Mobile floating search button ────────────────────────────────── */}
      <button
        ref={searchTriggerRef}
        className="app-shell__search-fab"
        onClick={openMobileSearch}
        aria-label="Open search"
        aria-expanded={mobileSearchOpen}
        aria-controls="mobile-search-modal"
      >
        <IconSearch />
      </button>

      {/* ── Mobile search modal overlay ──────────────────────────────────── */}
      {mobileSearchOpen && (
        <div
          id="mobile-search-modal"
          className="app-shell__search-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Search"
        >
          {/* Backdrop */}
          <div
            className="app-shell__search-modal-backdrop"
            onClick={closeMobileSearch}
            aria-hidden="true"
          />
          <div className="app-shell__search-modal-content">
            <SearchBar variant="hero" placeholder="Search ticker or company…" />
            <button
              className="app-shell__search-modal-close"
              onClick={closeMobileSearch}
              aria-label="Close search"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppShell;
