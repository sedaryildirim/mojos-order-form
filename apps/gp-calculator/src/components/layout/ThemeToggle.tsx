"use client";

import { useEffect, useState } from "react";

const KEY = "mojos_theme";

// Light/dark switch in the top bar. Dark is the default; the choice is remembered on this computer.
export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    setTheme(document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark");
  }, []);

  const next = theme === "light" ? "dark" : "light";
  return (
    <button
      type="button"
      onClick={() => {
        document.documentElement.setAttribute("data-theme", next);
        try { localStorage.setItem(KEY, next); } catch {}
        setTheme(next);
      }}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
    >
      {theme === "light" ? "\u263D" : "\u2600"}
    </button>
  );
}
