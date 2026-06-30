import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
} from 'chart.js';
import type { SparklinePoint } from '@lib/shared/stats';
import { readChartColor, withAlpha } from './chart-theme';

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
);

export function createSparkline(
  canvas: HTMLCanvasElement,
  points: SparklinePoint[],
  token: 'chart-1' | 'chart-2' | 'chart-3',
): Chart {
  const color = readChartColor(token);
  const labels = points.map((p) => p.x);
  const data = points.map((p) => p.y);

  return new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          data,
          borderColor: withAlpha(color, 0.65),
          backgroundColor: (ctx) => {
            const { chart } = ctx;
            const g = chart.ctx.createLinearGradient(0, 0, 0, chart.height);
            g.addColorStop(0, withAlpha(color, 0.12));
            g.addColorStop(1, withAlpha(color, 0));
            return g;
          },
          fill: true,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: {
        x: { display: false },
        y: { display: false },
      },
    },
  });
}

export function destroySparkline(chart: Chart | undefined): void {
  chart?.destroy();
}
