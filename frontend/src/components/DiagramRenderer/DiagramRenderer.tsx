import React from 'react';
import './DiagramRenderer.css';

interface DiagramRendererProps {
  src: string;
  alt: string;
  onTextOnlyToggle: () => void;
}

/**
 * DiagramRenderer — lazy-loaded diagram renderer.
 * 
 * For SVG or image URLs: renders as an <img> with full alt text.
 * AC: Includes accessible alt-text description.
 * AC: Lazy-loaded via React.lazy — not bundled into main chunk.
 */
const DiagramRenderer: React.FC<DiagramRendererProps> = ({ src, alt }) => {
  // Determine if this is an image URL or a Mermaid diagram (starts with "mermaid:")
  const isMermaid = src.startsWith('mermaid:');

  if (isMermaid) {
    // Mermaid diagrams are rendered as text descriptions only
    // (full Mermaid rendering would require the mermaid.js library)
    const mermaidCode = src.slice('mermaid:'.length);
    return (
      <figure className="diagram-renderer" role="figure" aria-label={alt}>
        <pre className="diagram-renderer__mermaid" aria-label={alt}>
          {mermaidCode}
        </pre>
        <figcaption className="diagram-renderer__caption">{alt}</figcaption>
      </figure>
    );
  }

  // Image URL
  return (
    <figure className="diagram-renderer" role="figure" aria-label={alt}>
      <img
        src={src}
        alt={alt}
        className="diagram-renderer__img"
        loading="lazy"
      />
      <figcaption className="diagram-renderer__caption">{alt}</figcaption>
    </figure>
  );
};

export default DiagramRenderer;
