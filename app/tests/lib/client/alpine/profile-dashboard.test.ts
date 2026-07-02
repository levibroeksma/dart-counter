/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { profileDashboard } from '@lib/client/alpine/profile-dashboard';

const mountMetricCharts = vi.fn();
const destroyMetricCharts = vi.fn();
const bindChartResize = vi.fn();

vi.mock('@lib/client/charts/mount-metric-charts', () => ({
  mountMetricCharts: (...args: unknown[]) => mountMetricCharts(...args),
  destroyMetricCharts: (...args: unknown[]) => destroyMetricCharts(...args),
  bindChartResize: (...args: unknown[]) => bindChartResize(...args),
}));

describe('profileDashboard', () => {
  beforeEach(() => {
    mountMetricCharts.mockReset();
    destroyMetricCharts.mockReset();
    bindChartResize.mockReset();
    bindChartResize.mockReturnValue(vi.fn());
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          displayName: 'Alex',
          gamesPlayed: 3,
          gamesWon: 1,
          metrics: {
            threeDartAverage: 45.12,
            scoringAverage: 48.3,
            checkoutPercentage: 14.2,
          },
          sparklines: [
            {
              kind: 'threeDartAverage',
              points: [
                { x: '2026-01-01', y: 40 },
                { x: '2026-01-02', y: 45 },
              ],
            },
          ],
        }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts loading and binds data after fetch', async () => {
    const state = profileDashboard();
    state.$el = document.createElement('section');
    state.$nextTick = (cb: () => void) => {
      cb();
      return Promise.resolve();
    };

    expect(state.isLoading).toBe(false);
    await state.init();

    expect(state.isLoading).toBe(false);
    expect(state.displayName).toBe('Alex');
    expect(state.gamesPlayed).toBe(3);
  });

  it('mounts charts and binds resize after content is shown', async () => {
    const state = profileDashboard();
    state.$el = document.createElement('section');
    state.$nextTick = (cb: () => void) => {
      cb();
      return Promise.resolve();
    };

    await state.init();

    expect(mountMetricCharts).toHaveBeenCalled();
    expect(bindChartResize).toHaveBeenCalled();
    expect(state.ready).toBe(true);
  });

  it('destroys charts and unbinds resize', async () => {
    const unbind = vi.fn();
    bindChartResize.mockReturnValue(unbind);
    const state = profileDashboard();
    state.$el = document.createElement('section');
    state.$nextTick = (cb: () => void) => {
      cb();
      return Promise.resolve();
    };

    await state.init();
    state.destroy();

    expect(destroyMetricCharts).toHaveBeenCalled();
    expect(unbind).toHaveBeenCalled();
  });

  it('showChart returns false when fewer than two points', () => {
    const state = profileDashboard();
    state.sparklines = [
      { kind: 'threeDartAverage', points: [{ x: '2026-01-01', y: 40 }] },
    ];
    expect(state.showChart('threeDartAverage')).toBe(false);
    expect(state.showChart('scoringAverage')).toBe(false);
  });
});
