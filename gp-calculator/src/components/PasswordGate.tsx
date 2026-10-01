"use client";

import { useEffect, useRef, useState } from "react";
import { GATE_STORAGE_KEY, GP_PASSWORD } from "@/lib/gate";
import { HOME_URL } from "@/lib/site";

// Asks for the password on first load of a browser session. The page stays rendered behind a
// frosted-glass overlay (blurred and not interactive) until it is unlocked.
export function PasswordGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<"checking" | "locked" | "open">("checking");
  const [value, setValue] = useState("");
  const [wrong, setWrong] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      setStatus(window.sessionStorage.getItem(GATE_STORAGE_KEY) === "1" ? "open" : "locked");
    } catch {
      setStatus("locked");
    }
  }, []);

  // keep keyboard and screen readers out of the page while it is locked
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    if (status === "open") el.removeAttribute("inert");
    else el.setAttribute("inert", "");
  }, [status]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (value === GP_PASSWORD) {
      try {
        window.sessionStorage.setItem(GATE_STORAGE_KEY, "1");
      } catch {
        // storage blocked: unlocked for this page view only
      }
      setStatus("open");
      return;
    }
    setWrong(true);
    setValue("");
  }

  return (
    <>
      <div ref={contentRef} data-gate-content={status} aria-hidden={status === "locked" ? true : undefined}>
        {children}
      </div>

      {status === "locked" && (
        <div data-gate-overlay>
          <div role="dialog" aria-modal="true" aria-labelledby="gate-title" aria-describedby="gate-help" data-gate-panel>
            <p data-gate-kicker>Kaif GP Calculator</p>
            <h1 id="gate-title">Enter password</h1>
            <p id="gate-help">This tool is protected. Enter the password to continue.</p>
            <form onSubmit={submit}>
              <div>
                <label htmlFor="gate-password">Password</label>
                <input
                  id="gate-password"
                  type="password"
                  autoComplete="current-password"
                  autoFocus
                  value={value}
                  aria-invalid={wrong ? true : undefined}
                  aria-describedby={wrong ? "gate-error" : undefined}
                  onChange={(e) => {
                    setValue(e.target.value);
                    setWrong(false);
                  }}
                />
                {wrong && (
                  <p id="gate-error" role="alert">
                    That password is not correct. Try again.
                  </p>
                )}
              </div>
              <button type="submit">Unlock</button>
            </form>
            <a href={HOME_URL} data-gate-back>
              Back to menu
            </a>
          </div>
        </div>
      )}
    </>
  );
}
