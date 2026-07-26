// @vitest-environment node
/**
 * Typography integration checks for tokens.css
 *
 * Verifies:
 * 1. Inter and JetBrains Mono are declared in the Google Fonts @import URL
 * 2. --font-ui and --font-mono tokens have system-font fallbacks
 * 3. .font-mono utility uses tabular-nums for alignment of negative numbers
 * 4. Type scale tokens span xs → 3xl
 *
 * Runs in the Node.js environment (see @vitest-environment directive above)
 * so that Node built-ins fs, path, and __dirname are available.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const css = readFileSync(resolve(__dirname, './tokens.css'), 'utf-8');

describe('Typography tokens', () => {
  it('loads Inter via Google Fonts @import', () => {
    expect(css).toContain('fonts.googleapis.com');
    expect(css).toContain('Inter');
  });

  it('loads JetBrains Mono via Google Fonts @import', () => {
    expect(css).toContain('JetBrains+Mono');
  });

  it('--font-ui has system-ui fallback for offline resilience', () => {
    expect(css).toContain('system-ui');
  });

  it('--font-mono has ui-monospace fallback', () => {
    expect(css).toContain('ui-monospace');
  });

  it('.font-mono sets tabular-nums for negative number alignment', () => {
    expect(css).toContain('.font-mono');
    expect(css).toContain('tabular-nums');
  });

  it('defines full type scale xs through 3xl', () => {
    const scaleKeys = ['--text-xs', '--text-sm', '--text-base', '--text-md', '--text-lg', '--text-xl', '--text-2xl', '--text-3xl'];
    for (const key of scaleKeys) {
      expect(css, `Missing type scale token: ${key}`).toContain(key + ':');
    }
  });

  it('--text-xs is 11px', () => {
    expect(css).toMatch(/--text-xs:\s*11px/);
  });

  it('--text-3xl is 30px or larger', () => {
    const match = css.match(/--text-3xl:\s*(\d+)px/);
    expect(match).not.toBeNull();
    expect(parseInt(match![1])).toBeGreaterThanOrEqual(30);
  });
});
