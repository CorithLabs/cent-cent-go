import { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { TopNav } from './components/TopNav/TopNav';

// Lazy-load pages for code splitting
const HomePage = lazy(() => import('./pages/HomePage'));
const StockDetailPage = lazy(() => import('./pages/StockDetailPage'));
const StockChartPage = lazy(() => import('./pages/StockChartPage'));
const FinancialsPage = lazy(() => import('./pages/FinancialsPage'));
const EconomicsPage = lazy(() => import('./pages/EconomicsPage'));
const EconomicsDetailPage = lazy(() => import('./pages/EconomicsDetailPage'));
const ComparePage = lazy(() => import('./pages/ComparePage'));
const SectorsPage = lazy(() => import('./pages/SectorsPage'));
const LearnPage = lazy(() => import('./pages/LearnPage'));
const LearnArticlePage = lazy(() => import('./pages/LearnArticlePage'));
const WatchlistPage = lazy(() => import('./pages/WatchlistPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

function App() {
  return (
    <div className="app">
      <TopNav />
      <main className="app__main">
        <Suspense fallback={<div className="page-loading">Loading…</div>}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/stock/:ticker" element={<StockDetailPage />} />
            <Route path="/stock/:ticker/chart" element={<StockChartPage />} />
            <Route path="/stock/:ticker/financials" element={<FinancialsPage />} />
            <Route path="/economics" element={<EconomicsPage />} />
            <Route path="/economics/:indicator" element={<EconomicsDetailPage />} />
            <Route path="/compare" element={<ComparePage />} />
            <Route path="/sectors" element={<SectorsPage />} />
            <Route path="/learn" element={<LearnPage />} />
            <Route path="/learn/:slug" element={<LearnArticlePage />} />
            <Route path="/watchlist" element={<WatchlistPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}

export default App;
