"use client";

import { useState } from "react";

interface ScalerLine {
  name: string;
  quantity: number;
  unit: string;
}

const UNIT_LABEL: Record<string, string> = { G: "g", KG: "kg", ML: "ml", L: "l", EACH: "" };

function format(n: number): string {
  if (n >= 100) return String(Math.round(n));
  return String(Math.round(n * 10) / 10);
}

// Read-only helper for the kitchen: how much of everything for a different number of batches
// or a target number of portions. Nothing here is saved.
export function BatchScaler({ lines, portions }: { lines: ScalerLine[]; portions: number | null }) {
  const [batches, setBatches] = useState<number>(1);
  const [mode, setMode] = useState<"batches" | "portions">("batches");
  const [wanted, setWanted] = useState<number | undefined>(undefined);

  if (lines.length === 0) return null;
  const factor = mode === "portions" && portions && wanted ? wanted / portions : batches;

  return (
    <details>
      <summary>Scale this batch</summary>
      <div>
        {portions !== null && (
          <div>
            <label htmlFor="scale-mode">
              Scale by
            </label>
            <select id="scale-mode" value={mode} onChange={(e) => setMode(e.target.value as "batches" | "portions")}>
              <option value="batches">Number of batches</option>
              <option value="portions">Portions wanted</option>
            </select>
          </div>
        )}
        {mode === "batches" || portions === null ? (
          <div>
            <label htmlFor="scale-batches">
              Batches
            </label>
            <input id="scale-batches" type="number" min="0" step="any" value={batches}
              onChange={(e) => setBatches(Number(e.target.value))} />
          </div>
        ) : (
          <div>
            <label htmlFor="scale-portions">
              Portions (one batch makes {format(portions)})
            </label>
            <input id="scale-portions" type="number" min="0" step="any" value={wanted ?? ""}
              onChange={(e) => setWanted(e.target.value ? Number(e.target.value) : undefined)} />
          </div>
        )}
        <p>= {format(factor)}× the recipe</p>
      </div>
      <table>
        <tbody>
          {lines.map((l, i) => (
            <tr key={`${l.name}-${i}`}>
              <td>{l.name}</td>
              <td>
                {format(l.quantity * factor)} {UNIT_LABEL[l.unit] ?? l.unit}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
