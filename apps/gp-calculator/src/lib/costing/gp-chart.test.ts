import { describe, expect, it } from "vitest";
import { chartGeometry, niceTicks } from "./gp-chart";
import type { GpPoint } from "./gp-history";

const pt = (n: number, cost: number, price: number | null): GpPoint => ({
  id: `p${n}`, at: new Date(Date.UTC(2026, 8, n)).toISOString(), label: `v${n}`, reason: "x", cost, sellingPrice: price,
  gpPct: price ? ((price - cost) / price) * 100 : null,
});
const OPTS = { width: 640, height: 280, target: 75 };

describe("niceTicks", () => {
  it("gives rounded, increasing values that cover the range", () => {
    const t = niceTicks(62.3, 81.7, 5);
    expect(t.length).toBeGreaterThanOrEqual(3);
    expect(t[0]).toBeLessThanOrEqual(62.3);
    expect(t[t.length - 1]).toBeGreaterThanOrEqual(81.7);
    expect(t.every((v, i) => i === 0 || v > t[i - 1])).toBe(true);
    expect(t.every((v) => Number.isInteger(v * 10))).toBe(true);
  });
  it("copes with a flat range", () => {
    const t = niceTicks(70, 70, 5);
    expect(t.length).toBeGreaterThanOrEqual(2);
    expect(t[0]).toBeLessThan(70);
    expect(t[t.length - 1]).toBeGreaterThan(70);
  });
});

describe("chartGeometry", () => {
  const six = [pt(1, 25, 100), pt(2, 28, 100), pt(3, 26, 100), pt(4, 32, 100), pt(5, 30, 100), pt(6, 27, 100)];

  it("plots GP% when every point has a menu price, with higher GP drawn higher up", () => {
    const g = chartGeometry(six, OPTS);
    expect(g.mode).toBe("gp");
    expect(g.xs).toHaveLength(6);
    expect(g.xs.every((x, i) => i === 0 || x > g.xs[i - 1])).toBe(true);
    // v1 has 75% GP, v4 has 68%: v1 sits above (smaller y) v4
    expect(g.ys[0]).toBeLessThan(g.ys[3]);
  });

  it("keeps every point and the target line inside the plot area", () => {
    const g = chartGeometry(six, OPTS);
    for (const y of g.ys) {
      expect(y).toBeGreaterThanOrEqual(g.plot.top);
      expect(y).toBeLessThanOrEqual(g.plot.bottom);
    }
    expect(g.target).not.toBeNull();
    expect(g.target!.y).toBeGreaterThanOrEqual(g.plot.top);
    expect(g.target!.y).toBeLessThanOrEqual(g.plot.bottom);
  });

  it("includes the target in the scale even when every point is far from it", () => {
    const g = chartGeometry([pt(1, 10, 100), pt(2, 12, 100)], OPTS); // ~90% GP, target 75
    expect(g.target!.y).toBeLessThanOrEqual(g.plot.bottom);
  });

  it("falls back to cost when some point has no menu price, and draws no target", () => {
    const g = chartGeometry([pt(1, 25, 100), pt(2, 28, null)], OPTS);
    expect(g.mode).toBe("cost");
    expect(g.target).toBeNull();
    expect(g.ys[1]).toBeLessThan(g.ys[0]); // dearer cost is higher up
  });

  it("a single point is centred and has no line", () => {
    const g = chartGeometry([pt(1, 25, 100)], OPTS);
    expect(g.xs).toHaveLength(1);
    expect(Math.abs(g.xs[0] - (g.plot.left + g.plot.right) / 2)).toBeLessThan(1);
    expect(g.line).toBe("");
  });

  it("never zooms in on a tiny range: GP always spans at least 16 points, cost at least a fifth of itself", () => {
    const one = chartGeometry([pt(1, 28, 100)], OPTS); // 72% GP, target 75
    const span = one.yTicks[one.yTicks.length - 1].value - one.yTicks[0].value;
    expect(span).toBeGreaterThanOrEqual(16);
    const cost = chartGeometry([pt(1, 100, null), pt(2, 101, null)], OPTS);
    expect(cost.yTicks[cost.yTicks.length - 1].value - cost.yTicks[0].value).toBeGreaterThanOrEqual(20);
  });

  it("builds a line through every point and an area closed to the baseline", () => {
    const g = chartGeometry(six, OPTS);
    expect(g.line.startsWith("M")).toBe(true);
    expect((g.line.match(/L/g) ?? []).length).toBe(5);
    expect(g.area.endsWith("Z")).toBe(true);
  });

  it("labels the axis in percent for GP and in baht for cost", () => {
    expect(chartGeometry(six, OPTS).yTicks[0].label).toMatch(/%$/);
    expect(chartGeometry([pt(1, 25, null)], OPTS).yTicks[0].label).toMatch(/^฿/);
  });
});
