import React from 'react';
import { useParams } from 'react-router-dom';

const StockDetailPage: React.FC = () => {
  const { ticker } = useParams<{ ticker: string }>();
  return (
    <div style={{ padding: 24 }}>
      <h2>Stock: {ticker?.toUpperCase()}</h2>
      <p>Stock detail coming soon.</p>
    </div>
  );
};

export default StockDetailPage;
