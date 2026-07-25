import React from 'react';
import { useParams } from 'react-router-dom';

const EconomicsDetailPage: React.FC = () => {
  const { indicator } = useParams<{ indicator: string }>();
  return <div style={{ padding: 24 }}><h2>Indicator: {indicator}</h2></div>;
};

export default EconomicsDetailPage;
