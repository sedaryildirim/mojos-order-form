"use client";

import { useEffect, useState } from "react";

export type ViewMode = "cards" | "table";

// Remembers cards vs table per list, in this browser only. Lists open as a table (easier to scan and sort);
// a saved choice wins.
export function useViewMode(key: string): [ViewMode, (m: ViewMode) => void] {
  const [mode, setMode] = useState<ViewMode>("table");
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(`gp-view-${key}`);
      if (saved === "cards" || saved === "table") setMode(saved);
    } catch {
      // storage blocked: stay on the table
    }
  }, [key]);
  function update(next: ViewMode) {
    setMode(next);
    try {
      window.localStorage.setItem(`gp-view-${key}`, next);
    } catch {
      // not remembered, still works
    }
  }
  return [mode, update];
}
