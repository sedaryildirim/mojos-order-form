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

// A table that scrolls sideways has to be reachable with the keyboard, so give it a focus stop and a name.
// It is removed again when the table fits (e.g. after the window is widened).
function markScrollRegion(table: HTMLTableElement) {
  const wrap = table.parentElement;
  if (!wrap) return;
  const overflowX = getComputedStyle(wrap).overflowX;
  const scrolls = (overflowX === "auto" || overflowX === "scroll") && wrap.scrollWidth > wrap.clientWidth + 1;
  if (scrolls) {
    wrap.setAttribute("tabindex", "0");
    wrap.setAttribute("role", "region");
    if (!wrap.hasAttribute("aria-label")) wrap.setAttribute("aria-label", "Table, scrolls sideways");
  } else if (wrap.getAttribute("aria-label") === "Table, scrolls sideways") {
    wrap.removeAttribute("tabindex");
    wrap.removeAttribute("role");
    wrap.removeAttribute("aria-label");
  }
}

export function TableAlign() {
  useEffect(() => {
    let queued = false;
    const run = () => {
      queued = false;
      document.querySelectorAll("table").forEach((t) => {
        markTable(t);
        markScrollRegion(t);
      });
    };
    const schedule = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(run);
    };
    // The first pass waits until the browser is idle, so React has finished hydrating the page:
    // editing table cells while it is still hydrating makes it warn about "extra attributes".
    let observer: MutationObserver | undefined;
    const start = () => {
      run();
      observer = new MutationObserver(schedule);
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    };
    // Safari has no requestIdleCallback, so fall back to a short timer there
    const hasIdle = typeof window.requestIdleCallback === "function";
    const idle = hasIdle ? window.requestIdleCallback(start, { timeout: 400 }) : window.setTimeout(start, 200);
    window.addEventListener("resize", schedule);
    return () => {
      if (hasIdle) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
      window.removeEventListener("resize", schedule);
      observer?.disconnect();
    };
  }, []);

  return null;
}
