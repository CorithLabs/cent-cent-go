import React from 'react';
import { Link } from 'react-router-dom';

const NotFoundPage: React.FC = () => (
  <div style={{ textAlign: 'center', padding: '80px 24px' }}>
    <h1>404 — Page not found</h1>
    <p style={{ marginTop: 16, color: 'var(--color-muted)' }}>
      The page you're looking for doesn't exist.
    </p>
    <Link to="/" style={{ display: 'inline-block', marginTop: 24 }}>
      ← Back to home
    </Link>
  </div>
);

export default NotFoundPage;
