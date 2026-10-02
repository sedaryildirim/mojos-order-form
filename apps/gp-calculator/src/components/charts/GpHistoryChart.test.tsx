import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { GpHistoryChart } from "./GpHistoryChart";
import type { GpPoint } from "@/lib/costing/gp-history";

afterEach(cleanup);

const pt = (n: number, cost: number, price: number | null, reason = "Ingredient prices updated"): GpPoint => ({
  id: `p${n}`, at: new Date(Date.UTC(2026, 8, n, 3, 0)).toISOString(), label: `v${n}`, reason, cost, sellingPrice: price,
  gpPct: price ? ((price - cost) / price) * 100 : null,
});
const three = [pt(1, 25, 100, "Recipe created"), pt(2, 30, 100), pt(3, 28, 100)];

describe("GpHistoryChart", () => {
  it("shows the latest GP, the change since the update before, and how many updates are shown", () => {
    render(<GpHistoryChart points={three} />);
    expect(screen.getByRole("heading", { name: /GP history/i })).toBeTruthy();
    expect(screen.getByText(/Last 3 updates/i)).toBeTruthy();
    const readout = screen.getByTestId("gp-readout");
    expect(readout.textContent).toContain("72.0%"); // (100 - 28) / 100
    expect(readout.textContent).toContain("2.0 pts"); // up from 70.0%
    expect(readout.querySelector('[data-tone="up"]')).not.toBeNull();
  });

  it("lists every update in a data table", () => {
    render(<GpHistoryChart points={three} />);
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(4); // header + 3
    expect(table.textContent).toContain("Recipe created");
    expect(table.textContent).toContain("฿30.00");
  });

  it("moving over an update (or focusing it) shows that update's figures", () => {
    render(<GpHistoryChart points={three} />);
    const dot = screen.getByLabelText(/v2.*70\.0%/);
    fireEvent.focus(dot);
    expect(screen.getByTestId("gp-readout").textContent).toContain("70.0%");
    expect(screen.getByTestId("gp-tooltip").textContent).toContain("Ingredient prices updated");
    fireEvent.blur(dot);
    expect(screen.getByTestId("gp-readout").textContent).toContain("72.0%");
    expect(screen.queryByTestId("gp-tooltip")).toBeNull();
  });

  it("the mouse picks the nearest update", () => {
    render(<GpHistoryChart points={three} />);
    const svg = screen.getByRole("img", { name: /GP history/i });
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 640, height: 280, right: 640, bottom: 280, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    const overlay = svg.querySelector("[data-chart-overlay]")!;
    fireEvent.mouseMove(overlay, { clientX: 20, clientY: 100 }); // far left: the first update
    expect(screen.getByTestId("gp-readout").textContent).toContain("75.0%");
    fireEvent.mouseLeave(overlay);
    expect(screen.getByTestId("gp-readout").textContent).toContain("72.0%");
  });

  it("with one update it says the line will draw as prices change, and draws no line", () => {
    const { container } = render(<GpHistoryChart points={[pt(1, 25, 100, "Recipe created")]} />);
    expect(screen.getByText(/draws as prices change/i)).toBeTruthy();
    expect(container.querySelector("path[data-chart-line]")).toBeNull();
    expect(screen.getByTestId("gp-readout").textContent).toContain("75.0%");
  });

  it("shows cost in baht when there is no menu price", () => {
    render(<GpHistoryChart points={[pt(1, 25, null), pt(2, 31.2, null)]} />);
    const readout = screen.getByTestId("gp-readout");
    expect(readout.textContent).toContain("฿31.20");
    expect(readout.textContent).toMatch(/cost/i);
    expect(screen.queryByText(/Target/)).toBeNull();
  });

  it("draws the target line for GP", () => {
    render(<GpHistoryChart points={three} />);
    expect(screen.getAllByText(/Target 75%/).length).toBeGreaterThan(0);
  });

  it("says so when there is no history at all", () => {
    render(<GpHistoryChart points={[]} />);
    expect(screen.getByText(/No history yet/i)).toBeTruthy();
  });
});
