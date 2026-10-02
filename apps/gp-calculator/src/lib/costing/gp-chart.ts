import type { GpPoint } from "./gp-history";

// Geometry for the GP history chart: where each point, gridline and label goes. No drawing happens here.

interface ChartOptions {
  width: number;
  height: number;
  // The GP target, in percent. Drawn as a dashed line when the chart shows GP.
  target: number;
}

interface ChartGeometry {
  mode: "gp" | "cost";
  plot: { left: number; right: number; top: number; bottom: number };
  xs: number[];
  ys: number[];
  values: number[];
  yTicks: { value: number; y: number; label: string }[];
  target: { y: number; label: string } | null;
  line: string;
  area: string;
}

// Rounded gridline values (1, 2, 5 x 10^n steps) that cover [min, max].
export function niceTicks(min: number, max: number, count: number): number[] {
  if (!(max > min)) {
    const pad = Math.max(Math.abs(min) * 0.1, 1);
    return niceTicks(min - pad, max + pad, count);
  }
  const rough = (max - min) / Math.max(count - 1, 1);
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const frac = rough / pow;
  const step = (frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10) * pow;
  const first = Math.floor(min / step) * step;
  const last = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = first; v <= last + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return ticks;
}

const baht = (v: number) => `฿${v.toFixed(v % 1 === 0 ? 0 : 2)}`;
const percent = (v: number) => `${v.toFixed(v % 1 === 0 ? 0 : 1)}%`;

export function chartGeometry(points: GpPoint[], opts: ChartOptions): ChartGeometry {
  const { width, height } = opts;
  // The price axis sits on the right, like a trading terminal, so the right margin holds its labels.
  const plot = { left: 16, right: width - 64, top: 18, bottom: height - 34 };
  const mode: "gp" | "cost" = points.length > 0 && points.every((p) => p.gpPct !== null) ? "gp" : "cost";
  const values = points.map((p) => (mode === "gp" ? (p.gpPct as number) : p.cost));
  const targetValue = mode === "gp" ? opts.target : null;

  const domain = [...values, ...(targetValue === null ? [] : [targetValue])];
  let lo = Math.min(...domain);
  let hi = Math.max(...domain);
  // A tiny range would blow a tiny change up into a dramatic one, so keep the scale readable.
  const minSpan = mode === "gp" ? 16 : Math.max(Math.abs(hi) * 0.2, 1);
  if (hi - lo < minSpan) {
    const mid = (hi + lo) / 2;
    lo = mid - minSpan / 2;
    hi = mid + minSpan / 2;
  }
  const pad = (hi - lo) * 0.08;
  const ticks = niceTicks(lo - pad, hi + pad, 5);
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const yOf = (v: number) => plot.bottom - ((v - yMin) / (yMax - yMin)) * (plot.bottom - plot.top);

  // Updates are evenly spaced (not by clock time), so two changes minutes apart do not sit on top of each other.
  const inner = { left: plot.left + 28, right: plot.right - 28 };
  const xs = points.map((_, i) => (points.length === 1 ? (plot.left + plot.right) / 2 : inner.left + (i * (inner.right - inner.left)) / (points.length - 1)));
  const ys = values.map(yOf);

  const line = points.length < 2 ? "" : xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  const area = points.length < 2 ? "" : `${line} L${xs[xs.length - 1].toFixed(1)},${plot.bottom} L${xs[0].toFixed(1)},${plot.bottom} Z`;
  const fmt = mode === "gp" ? percent : baht;

  return {
    mode, plot, xs, ys, values,
    yTicks: ticks.map((value) => ({ value, y: yOf(value), label: fmt(value) })),
    target: targetValue === null ? null : { y: yOf(targetValue), label: `Target ${percent(targetValue)}` },
    line, area,
  };
}
