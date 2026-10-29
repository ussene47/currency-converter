/**
 * Rate history chart. Chart.js is loaded lazily from cdnjs the first time a
 * chart is drawn, so it never delays the converter itself.
 */
import { formatNumber } from './utils.js';

export const CHART_JS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';

let loading = null;

/** @returns {Promise<any>} the global Chart constructor */
export function loadChartJs() {
  if (globalThis.Chart) return Promise.resolve(globalThis.Chart);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = CHART_JS_URL;
      s.async = true;
      s.crossOrigin = 'anonymous';
      s.onload = () => resolve(globalThis.Chart);
      s.onerror = () => {
        loading = null;
        s.remove();
        reject(new Error('chart-lib'));
      };
      document.head.append(s);
    });
  }
  return loading;
}

let chart = null;

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * Draw (or redraw) the line chart.
 * @param {HTMLCanvasElement} canvas
 * @param {{date: string, rate: number}[]} points
 * @param {{locale: string, label: string}} opts
 */
export async function drawChart(canvas, points, { locale, label }) {
  const Chart = await loadChartJs();
  const accent = cssVar('--accent');
  const muted = cssVar('--muted');
  const border = cssVar('--border');
  const surface = cssVar('--surface');
  const ink = cssVar('--ink');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const fmtDate = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' });
  const labels = points.map((p) => fmtDate.format(new Date(`${p.date}T12:00:00Z`)));
  const data = points.map((p) => p.rate);

  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.clientHeight || 220);
  gradient.addColorStop(0, hexToRgba(accent, 0.28));
  gradient.addColorStop(1, hexToRgba(accent, 0));
  const fill = gradient;

  const config = {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label,
        data,
        borderColor: accent,
        backgroundColor: fill,
        fill: true,
        tension: 0.35,
        borderWidth: 2.25,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: accent,
        pointHoverBorderColor: surface,
        pointHoverBorderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: reduced ? false : { duration: 500 },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: ink,
          titleColor: surface,
          bodyColor: surface,
          displayColors: false,
          padding: 10,
          cornerRadius: 10,
          callbacks: { label: (c) => `${label}: ${formatNumber(c.parsed.y, locale, 4)}` },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { color: muted, maxRotation: 0, autoSkipPadding: 18, font: { size: 11 } },
        },
        y: {
          grid: { color: border },
          border: { display: false },
          ticks: {
            color: muted,
            font: { size: 11 },
            maxTicksLimit: 5,
            callback: (v) => formatNumber(Number(v), locale),
          },
        },
      },
    },
  };

  if (chart && chart.canvas === canvas) {
    chart.data = config.data;
    chart.options = config.options;
    chart.update();
  } else {
    chart?.destroy();
    chart = new Chart(ctx, config);
  }
}

/** Destroy the chart (used when the data is unavailable). */
export function clearChart() {
  chart?.destroy();
  chart = null;
}

function hexToRgba(hex, alpha) {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex);
  if (!m) return 'transparent';
  return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${alpha})`;
}
