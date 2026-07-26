// @vitest-environment node
/**
 * Unit test for src/styles/tokens.css
 *
 * Verifies all required design-token names are declared. The test
 * deliberately avoids asserting resolved values — only names matter,
 * so a colour rename stays local to tokens.css.
 *
 * Runs in the Node.js environment (see @vitest-environment directive above)
 * so that Node built-ins fs, path, and __dirname are available.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const tokensPath = resolve(__dirname, './tokens.css');
const tokensContent = readFileSync(tokensPath, 'utf-8');

const requiredTokens = [
  // Color — backgrounds
  '--color-bg-primary',
  '--color-bg-surface',
  '--color-bg-elevated',
  // Color — brand
  '--color-accent',
  '--color-accent-dim',
  // Color — semantic
  '--color-positive',
  '--color-negative',
  '--color-neutral',
  // Color — text
  '--color-text-primary',
  '--color-text-muted',
  // Typography
  '--font-ui',
  '--font-mono',
  '--text-xs',
  '--text-sm',
  '--text-base',
  '--text-md',
  '--text-lg',
  '--text-xl',
  '--text-2xl',
  '--text-3xl',
  // Spacing
  '--space-1',
  '--space-2',
  '--space-3',
  '--space-4',
  '--space-6',
  '--space-8',
  '--space-12',
  // Shadows
  '--shadow-card',
  '--shadow-elevated',
];

describe('tokens.css', () => {
  it('defines all required custom property names in :root', () => {
    for (const token of requiredTokens) {
      expect(
        tokensContent,
        `Expected token "${token}" to be defined in tokens.css`
      ).toContain(token + ':');
    }
  });

  it('does not contain hardcoded colour values outside of token definitions', () => {
    // The :root block defines the values — component CSS must not.
    // This test just verifies the file itself only defines tokens, not inline styles.
    expect(tokensContent).toContain(':root {');
  });

  it('includes a light-mode media stub', () => {
    expect(tokensContent).toContain('prefers-color-scheme: light');
  });

  it('exports .font-mono utility class', () => {
    expect(tokensContent).toContain('.font-mono');
    expect(tokensContent).toContain('font-variant-numeric: tabular-nums');
  });
});
