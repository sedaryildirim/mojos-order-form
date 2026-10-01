"use client";

import type { ViewMode } from "@/lib/use-view-mode";

export function ViewToggle({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  return (
    <div role="group" aria-label="Layout">
      {(["cards", "table"] as const).map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={mode === m}
          onClick={() => onChange(m)}
        >
          {m === "cards" ? "Cards" : "Table"}
        </button>
      ))}
    </div>
  );
}
