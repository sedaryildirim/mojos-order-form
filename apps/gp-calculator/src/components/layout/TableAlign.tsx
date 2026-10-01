"use client";

import { useEffect } from "react";

// Right-aligns number columns (money, percentages, quantities) so digits line up when scanning a list.
// A column counts as numeric when every filled cell in it looks like a number; it works on any table,
// including ones that appear after data loads.
const NUMERIC = /^[฿$]?\s*-?[\d,]+(\.\d+)?\s*(%|g|kg|ml|l|pcs|each|portions?)?(\s+low)?(\s*\(.*\))?$/i;
const NEUTRAL = /^(n\/a|none|not set|no recipe|—|-)?$/i;

function markTable(table: HTMLTableElement) {
  const body = table.tBodies[0];
  const head = table.rows[0];
  if (!body || !head) return;
  const columns = head.cells.length;
  const rows = Array.from(body.rows).filter((r) => r.cells.length === columns);
  if (rows.length === 0) return;

  for (let c = 0; c < columns; c++) {
    let numeric = 0;
    let other = 0;
    for (const r of rows) {
      const text = (r.cells[c].textContent ?? "").trim();
      if (NEUTRAL.test(text)) continue;
      if (NUMERIC.test(text)) numeric++;
      else other++;
    }
    const isNumber = numeric > 0 && other === 0;
    head.cells[c].toggleAttribute("data-num", isNumber);
    for (const r of rows) r.cells[c].toggleAttribute("data-num", isNumber);
  }
}

export function TableAlign() {
  useEffect(() => {
    let queued = false;
    const run = () => {
      queued = false;
      document.querySelectorAll("table").forEach(markTable);
    };
    const schedule = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(run);
    };
    run();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
