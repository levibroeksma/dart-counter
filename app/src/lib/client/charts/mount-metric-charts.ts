import type { Chart } from 'chart.js';
import type { MetricKind, SparklineSeries } from '@lib/shared/stats';
import { createSparkline, destroySparkline } from './sparkline';

export function mountMetricCharts(
  root: HTMLElement,
  series: SparklineSeries[],
  charts: Map<string, Chart>,
): void {
  const cards = root.querySelectorAll<HTMLElement>('[data-metric-kind]');
  for (const card of cards) {
    const kind = card.dataset.metricKind as MetricKind | undefined;
    const token = card.dataset.chartToken as
      | 'chart-1'
      | 'chart-2'
      | 'chart-3'
      | undefined;
    const canvas = card.querySelector('canvas');
    const match = series.find((s) => s.kind === kind);
    if (!canvas || !kind || !token || !match || match.points.length < 2) {
      continue;
    }
    const chart = createSparkline(canvas, match.points, token);
    chart.resize();
    charts.set(kind, chart);
  }
}

export function destroyMetricCharts(charts: Map<string, Chart>): void {
  for (const chart of charts.values()) {
    destroySparkline(chart);
  }
  charts.clear();
}

/**
 * Observes layout changes and window resize; calls chart.resize() on each chart.
 * Returns teardown — call from Alpine destroy().
 */
export function bindChartResize(
  root: HTMLElement,
  charts: Map<string, Chart>,
): () => void {
  let frameId = 0;

  const resizeAll = () => {
    cancelAnimationFrame(frameId);
    frameId = requestAnimationFrame(() => {
      for (const chart of charts.values()) {
        chart.resize();
      }
    });
  };

  const observer =
    typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(resizeAll)
      : null;
  observer?.observe(root);
  window.addEventListener('resize', resizeAll);

  return () => {
    cancelAnimationFrame(frameId);
    observer?.disconnect();
    window.removeEventListener('resize', resizeAll);
  };
}
