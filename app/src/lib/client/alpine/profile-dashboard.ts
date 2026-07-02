import type { Chart } from 'chart.js';
import type {
  ApiResponse,
  ProfileDashboardSuccess,
} from '@lib/shared/api/types';
import type {
  MetricKind,
  ProfileMetrics,
  SparklineSeries,
} from '@lib/shared/stats';
import {
  formatCheckoutPercentage,
  formatScoringAverage,
  formatThreeDartAverage,
} from '@lib/shared/stats';
import {
  bindChartResize,
  destroyMetricCharts,
  mountMetricCharts,
} from '@lib/client/charts/mount-metric-charts';

const EMPTY_METRICS: ProfileMetrics = {
  threeDartAverage: null,
  scoringAverage: null,
  checkoutPercentage: null,
};

interface ProfileDashboardState {
  $el: HTMLElement;
  $nextTick(cb: () => void): Promise<void>;
  isLoading: boolean;
  ready: boolean;
  error: string;
  displayName: string;
  gamesPlayed: number;
  gamesWon: number;
  metrics: ProfileMetrics;
  sparklines: SparklineSeries[];
  init(): Promise<void>;
  getDashboardData(): Promise<void>;
  destroy(): void;
  formattedThreeDartAverage(): string;
  formattedScoringAverage(): string;
  formattedCheckoutPercentage(): string;
  showChart(kind: MetricKind): boolean;
}

export function profileDashboard(): ProfileDashboardState {
  const charts = new Map<string, Chart>();
  let unbindResize: (() => void) | null = null;

  return {
    $el: undefined as unknown as HTMLElement,
    $nextTick: undefined as unknown as ProfileDashboardState['$nextTick'],
    isLoading: false,
    ready: false,
    error: '',
    displayName: 'You',
    gamesPlayed: 0,
    gamesWon: 0,
    metrics: { ...EMPTY_METRICS },
    sparklines: [],

    formattedThreeDartAverage() {
      return formatThreeDartAverage(this.metrics.threeDartAverage);
    },

    formattedScoringAverage() {
      return formatScoringAverage(this.metrics.scoringAverage);
    },

    formattedCheckoutPercentage() {
      return formatCheckoutPercentage(this.metrics.checkoutPercentage);
    },

    showChart(kind: MetricKind) {
      const series = this.sparklines.find((s) => s.kind === kind);
      return (series?.points.length ?? 0) >= 2;
    },

    async init() {
      await this.getDashboardData();

      if (this.error) return;

      await this.$nextTick(() => {
        requestAnimationFrame(() => {
          mountMetricCharts(this.$el, this.sparklines, charts);
          unbindResize = bindChartResize(this.$el, charts);
          this.ready = true;
        });
      });
    },

    async getDashboardData() {
      if (this.isLoading) return;
      this.isLoading = true;
      try {
        const response = await fetch('/api/profile/dashboard');
        const data = (await response.json()) as ApiResponse;

        if (!response.ok || !data.ok) {
          this.error = !data.ok ? data.code : 'fetch_failed';
          return;
        }

        const dashboard = data as ProfileDashboardSuccess;
        this.displayName = dashboard.displayName?.trim() || 'You';
        this.gamesPlayed = dashboard.gamesPlayed;
        this.gamesWon = dashboard.gamesWon;
        this.metrics = dashboard.metrics;
        this.sparklines = dashboard.sparklines;
      } catch {
        this.error = 'fetch_failed';
      } finally {
        this.isLoading = false;
      }
    },

    destroy() {
      unbindResize?.();
      unbindResize = null;
      destroyMetricCharts(charts);
      this.ready = false;
    },
  };
}
