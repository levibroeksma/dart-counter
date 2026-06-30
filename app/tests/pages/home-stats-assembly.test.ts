import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

function readSource(rel: string) {
  return readFileSync(path.resolve(process.cwd(), rel), 'utf8');
}

describe('homepage stats assembly', () => {
  it('wires ProfileStatsSection and dashboard fetch', () => {
    const index = readSource('src/pages/index.astro');
    expect(index).toContain('ProfileStatsSection');
    expect(index).toContain('getProfileDashboardData');
    expect(index).toContain('getPreferences');
  });

  it('ProfileMetricCard uses liquid layers', () => {
    const card = readSource('src/components/stats/ProfileMetricCard.astro');
    expect(card).toContain('card-metric-liquid');
    expect(card).toContain('card-metric-liquid-canvas');
    expect(card).toContain('card-metric-liquid-scrim');
  });
});
