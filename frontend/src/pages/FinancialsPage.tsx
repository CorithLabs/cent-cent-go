import React from 'react';
import { useParams } from 'react-router-dom';

const FinancialsPage: React.FC = () => {
  const { ticker } = useParams<{ ticker: string }>();
  return <div style={{ padding: 24 }}><h2>Financials: {ticker?.toUpperCase()}</h2></div>;
};

export default FinancialsPage;
