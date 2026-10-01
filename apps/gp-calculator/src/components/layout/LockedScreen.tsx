"use client";

import { useEffect, useState } from "react";
import { HOME_URL } from "@/lib/client/site";

// The password screen: a frosted-glass dialog over a blurred stand-in for the page. The password is
// checked on the server (POST /api/auth/login), which sets the session cookie; then the page reloads
// and the real screen appears at the same address.
export function LockedScreen() {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  // keep keyboard and screen readers out of the page behind the dialog
  useEffect(() => {
    const behind = Array.from(document.querySelectorAll<HTMLElement>('nav[aria-label="Main"], a[href="#main"], main[data-locked-backdrop]'));
    behind.forEach((el) => el.setAttribute("inert", ""));
    return () => behind.forEach((el) => el.removeAttribute("inert"));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !value) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: value }),
      });
      if (res.ok) {
        window.location.reload();
        return;
      }
      const body = await res.json().catch(() => null);
      setError(typeof body?.error === "string" ? body.error : "Could not unlock. Try again.");
      setValue("");
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div data-gate-overlay>
      <div role="dialog" aria-modal="true" aria-labelledby="gate-title" data-gate-panel>
        <h1 id="gate-title">Kaif GP Calculator</h1>
        <form onSubmit={submit}>
          <div>
            <label htmlFor="gate-password">Enter password</label>
            <input
              id="gate-password"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              autoFocus
              value={value}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "gate-error" : undefined}
              onChange={(e) => {
                setValue(e.target.value);
                setError(null);
              }}
            />
            {error && (
              <p id="gate-error" role="alert">
                {error}
              </p>
            )}
          </div>
          <button type="button" aria-pressed={show} onClick={() => setShow((s) => !s)} data-gate-toggle>
            {show ? "Hide password" : "Show password"}
          </button>
          <button type="submit" disabled={busy || !value}>
            {busy ? "Checking…" : "Unlock"}
          </button>
        </form>
        <a href={HOME_URL} data-gate-back>
          Back to all tools
        </a>
      </div>
    </div>
  );
}
