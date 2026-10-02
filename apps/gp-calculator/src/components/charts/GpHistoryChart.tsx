"use client";

import { useId, useRef, useState } from "react";
import { TARGET_GP_PCT } from "@/lib/costing/costing";
import { formatTHB } from "@/lib/costing/currency";
import { chartGeometry } from "@/lib/costing/gp-chart";
import type { GpPoint } from "@/lib/costing/gp-history";

const WIDTH = 640;
const HEIGHT = 280;

// Dates are shown in Bangkok time so the server's and the browser's text always match.
const shortDate = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Bangkok" }).format(new Date(iso));
const longDate = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }).format(new Date(iso));

const gpText = (v: number) => `${v.toFixed(1)}%`;

// GP (or cost) across the last few updates, drawn like a trading terminal: price axis on the right, a dashed target
// line, a tag on the latest value and a crosshair that follows the mouse or keyboard focus.
// data-tone "up" always means "better for the business": GP going up, or cost going down.
export function GpHistoryChart({ points, title = "GP history", target = TARGET_GP_PCT }: { points: GpPoint[]; title?: string; target?: number }) {
  const gradientId = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  if (points.length === 0) {
    return (
      <section aria-label={title} data-gp-chart>
        <h2>{title}</h2>
        <p>No history yet.</p>
      </section>
    );
  }

  const g = chartGeometry(points, { width: WIDTH, height: HEIGHT, target });
  const last = points.length - 1;
  const active = hover ?? last;
  const isGp = g.mode === "gp";
  const valueText = (i: number) => (isGp ? gpText(g.values[i]) : formatTHB(g.values[i]));
  const delta = active > 0 ? g.values[active] - g.values[active - 1] : null;
  const better = delta === null ? null : isGp ? delta > 0 : delta < 0;
  const trend = (first: number, now: number) => (isGp ? now >= first : now <= first);
  const lineTone = trend(g.values[0], g.values[last]) ? "up" : "down";
  const color = (tone: string) => (tone === "up" ? "var(--success)" : "var(--danger)");

  function nearest(clientX: number) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const x = ((clientX - rect.left) / rect.width) * WIDTH;
    let best = 0;
    g.xs.forEach((px, i) => {
      if (Math.abs(px - x) < Math.abs(g.xs[best] - x)) best = i;
    });
    setHover(best);
  }

  const describe = (i: number) =>
    `${points[i].label}: ${isGp ? `GP ${gpText(g.values[i])}, ` : ""}cost ${formatTHB(points[i].cost)}${points[i].sellingPrice ? `, menu price ${formatTHB(points[i].sellingPrice as number)}` : ""}, ${points[i].reason}`;
  const hovered = hover !== null;
  const tipLeft = (g.xs[active] / WIDTH) * 100;

  return (
    <section aria-label={title} data-gp-chart>
      <div data-chart-head>
        <h2>{title}</h2>
        <p>Last {points.length} update{points.length === 1 ? "" : "s"}</p>
      </div>

      <div data-testid="gp-readout" data-chart-readout>
        <span>{isGp ? "GP" : "Cost"}</span>
        <strong>{valueText(active)}</strong>
        {delta !== null && (
          <span data-tone={better ? "up" : delta === 0 ? "flat" : "down"}>
            {delta === 0 ? "No change" : `${delta > 0 ? "▲" : "▼"} ${isGp ? `${Math.abs(delta).toFixed(1)} pts` : formatTHB(Math.abs(delta))}`}
            {" since the update before"}
          </span>
        )}
        {delta === null && <span>First recorded</span>}
        <span>
          {points[active].label} · {shortDate(points[active].at)}
        </span>
      </div>

      <div data-chart-frame>
        <svg ref={svgRef} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`${title} chart: ${points.length} update${points.length === 1 ? "" : "s"}, latest ${valueText(last)}`}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color(lineTone)} stopOpacity="0.28" />
              <stop offset="100%" stopColor={color(lineTone)} stopOpacity="0" />
            </linearGradient>
          </defs>

          {g.yTicks.map((t) => (
            <g key={t.value}>
              <line x1={g.plot.left} x2={g.plot.right} y1={t.y} y2={t.y} data-grid />
              {/* the latest-value tag sits on the axis, so a gridline label that would sit under it is left out */}
              {Math.abs(t.y - g.ys[last]) >= 13 && (
                <text x={g.plot.right + 8} y={t.y + 4} data-axis>
                  {t.label}
                </text>
              )}
            </g>
          ))}
          {g.xs.map((x, i) => (
            <g key={points[i].id}>
              <line x1={x} x2={x} y1={g.plot.top} y2={g.plot.bottom} data-grid data-faint />
              <text x={x} y={g.plot.bottom + 20} textAnchor="middle" data-axis>
                {shortDate(points[i].at)}
              </text>
            </g>
          ))}

          {g.target && (
            <g>
              <line x1={g.plot.left} x2={g.plot.right} y1={g.target.y} y2={g.target.y} data-target />
              <text x={g.plot.left + 4} y={g.target.y - 6} data-target-label>
                {g.target.label}
              </text>
            </g>
          )}

          {g.area && <path d={g.area} fill={`url(#${gradientId})`} />}
          {g.line && <path d={g.line} data-chart-line style={{ stroke: color(lineTone) }} fill="none" />}

          <line x1={g.xs[last]} x2={g.plot.right} y1={g.ys[last]} y2={g.ys[last]} data-last-line style={{ stroke: color(lineTone) }} />
          <g data-last-tag>
            <rect x={g.plot.right + 2} y={g.ys[last] - 10} width={58} height={20} rx={3} style={{ fill: color(lineTone) }} />
            <text x={g.plot.right + 31} y={g.ys[last] + 4} textAnchor="middle">
              {valueText(last)}
            </text>
          </g>

          {hovered && (
            <g data-crosshair>
              <line x1={g.xs[active]} x2={g.xs[active]} y1={g.plot.top} y2={g.plot.bottom} />
              <line x1={g.plot.left} x2={g.plot.right} y1={g.ys[active]} y2={g.ys[active]} />
            </g>
          )}

          {g.xs.map((x, i) => (
            <circle
              key={points[i].id}
              cx={x}
              cy={g.ys[i]}
              r={i === last ? 5.5 : 4}
              tabIndex={0}
              role="img"
              aria-label={describe(i)}
              data-point
              data-active={i === active ? "true" : undefined}
              style={{ fill: color(lineTone), stroke: "var(--card)" }}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
            />
          ))}

          <rect
            x={g.plot.left}
            y={g.plot.top}
            width={g.plot.right - g.plot.left}
            height={g.plot.bottom - g.plot.top}
            fill="transparent"
            data-chart-overlay
            onMouseMove={(e) => nearest(e.clientX)}
            onClick={(e) => nearest(e.clientX)}
            onMouseLeave={() => setHover(null)}
          />
        </svg>

        {hovered && (
          <div data-testid="gp-tooltip" data-chart-tooltip style={{ left: `${tipLeft}%` }} data-flip={tipLeft > 60 ? "left" : undefined}>
            <p>
              {points[active].label} · {longDate(points[active].at)}
            </p>
            <p>{points[active].reason}</p>
            <dl>
              {isGp && (
                <>
                  <dt>GP</dt>
                  <dd>{gpText(g.values[active])}</dd>
                </>
              )}
              <dt>Cost</dt>
              <dd>{formatTHB(points[active].cost)}</dd>
              {points[active].sellingPrice !== null && (
                <>
                  <dt>Menu price</dt>
                  <dd>{formatTHB(points[active].sellingPrice as number)}</dd>
                </>
              )}
            </dl>
          </div>
        )}
      </div>

      {points.length === 1 && <p data-chart-hint>This is the first recorded cost. The line draws as prices change, up to the last 6 updates.</p>}

      <details>
        <summary>View data</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">Update</th>
              <th scope="col">Date</th>
              <th scope="col">What changed</th>
              <th scope="col" data-num>Cost</th>
              <th scope="col" data-num>Menu price</th>
              <th scope="col" data-num>GP</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.id}>
                <td>{p.label}</td>
                <td>{longDate(p.at)}</td>
                <td>{p.reason}</td>
                <td data-num>{formatTHB(p.cost)}</td>
                <td data-num>{p.sellingPrice === null ? "Not set" : formatTHB(p.sellingPrice)}</td>
                <td data-num>{p.gpPct === null ? "n/a" : gpText(p.gpPct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}
