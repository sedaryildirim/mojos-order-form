"use client";

import { useEffect, useState } from "react";

export type ViewMode = "cards" | "table";

// Remembers cards vs table per list, in this browser only.
export function useViewMode(key: string): [ViewMode, (m: ViewMode) => void] {
  const [mode, setMode] = useState<ViewMode>("cards");
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(`gp-view-${key}`);
      if (saved === "cards" || saved === "table") setMode(saved);
    } catch {
      // storage blocked: stay on cards
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
