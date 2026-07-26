import React from 'react';
import { useParams } from 'react-router-dom';
import { PriceChart } from '../components/PriceChart/PriceChart';

const StockChartPage: React.FC = () => {
  const { ticker } = useParams<{ ticker: string }>();
  return <PriceChart ticker={ticker!} />;
};

export default StockChartPage;
