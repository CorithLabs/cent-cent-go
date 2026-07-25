import React from 'react';
import { useParams } from 'react-router-dom';

const StockChartPage: React.FC = () => {
  const { ticker } = useParams<{ ticker: string }>();
  return <div style={{ padding: 24 }}><h2>Chart: {ticker?.toUpperCase()}</h2></div>;
};

export default StockChartPage;
