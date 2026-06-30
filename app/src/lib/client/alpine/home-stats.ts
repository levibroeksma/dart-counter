import type { SparklineSeries } from '@lib/shared/stats';
import {
  createSparkline,
  destroySparkline,
} from '@lib/client/charts/sparkline';
import type { Chart } from 'chart.js';

interface HomeStatsState {
  $el: HTMLElement;
  init(this: HomeStatsState): void;
  destroy(this: HomeStatsState): void;
}

export function homeStats(): HomeStatsState {
  const charts = new Map<string, Chart>();

  return {
    $el: undefined as unknown as HTMLElement,

    init() {
      const root = this.$el;
      const raw = root.dataset.sparklines;
      if (!raw) return;

      let series: SparklineSeries[];
      try {
        series = JSON.parse(raw) as SparklineSeries[];
      } catch {
        return;
      }

      const cards = root.querySelectorAll<HTMLElement>('[data-metric-kind]');
      for (const card of cards) {
        if (card.dataset.showChart !== 'true') continue;
        const kind = card.dataset.metricKind;
        const token = card.dataset.chartToken as
          | 'chart-1'
          | 'chart-2'
          | 'chart-3';
        const canvas = card.querySelector('canvas');
        const match = series.find((s) => s.kind === kind);
        if (!canvas || !match || match.points.length < 2) continue;

        const chart = createSparkline(canvas, match.points, token);
        charts.set(kind ?? '', chart);
      }
    },

    destroy() {
      for (const chart of charts.values()) destroySparkline(chart);
      charts.clear();
    },
  } satisfies HomeStatsState;
}
