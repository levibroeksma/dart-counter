import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const appRoot = resolve(import.meta.dirname, '../..');
const globalCss = readFileSync(
  resolve(appRoot, 'src/styles/global.css'),
  'utf8',
);
const baseLayout = readFileSync(
  resolve(appRoot, 'src/layouts/BaseLayout.astro'),
  'utf8',
);

describe('theme infrastructure', () => {
  it('uses shadcn hsl token hub in global.css', () => {
    expect(globalCss).toContain('--color-background: hsl(var(--background))');
    expect(globalCss).toContain('--background: 224 71% 4%');
    expect(globalCss).toContain('--primary: 248 100% 66%');
    expect(globalCss).toContain('--color-blue-500: #6751ff');
    expect(globalCss).toContain('--color-gray-950: #030712');
    expect(globalCss).toContain('--gradient-background:');
    expect(globalCss).toContain('--gradient-card-surface:');
    expect(globalCss).not.toContain('surface-page');
    expect(globalCss).not.toContain('prefers-color-scheme');
    expect(globalCss).not.toContain('data-theme');
  });

  it('registers tailwindcss-animate plugin', () => {
    expect(globalCss).toContain("tailwindcss-animate");
  });

  it('defines display and sans font tokens', () => {
    expect(globalCss).toContain('Bebas Neue');
    expect(globalCss).toContain('Inter');
  });

  it('loads Google Fonts in BaseLayout', () => {
    expect(baseLayout).toContain('fonts.googleapis.com');
    expect(baseLayout).toContain('Bebas+Neue');
    expect(baseLayout).toContain('Inter');
  });
});

describe('theme migration completeness', () => {
  it('has no legacy token class names in src', () => {
    const legacyClassPattern = String.raw`\b(bg-surface-|text-text-|bg-accent|text-accent|border-accent|ring-accent|accent-hover|text-error\b)`;
    const result = execSync(`rg -l '${legacyClassPattern}' src/ || true`, {
      cwd: appRoot,
      encoding: 'utf8',
    }).trim();
    expect(result).toBe('');
  });
});
