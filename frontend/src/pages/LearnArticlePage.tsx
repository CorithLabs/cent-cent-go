import React from 'react';
import { useParams } from 'react-router-dom';

const LearnArticlePage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  return <div style={{ padding: 24 }}><h2>Article: {slug}</h2></div>;
};

export default LearnArticlePage;
