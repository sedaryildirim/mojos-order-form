"use client";

import { useEffect, useRef, useState } from "react";

// Two-step button for risky actions: click once to ask, click "Confirm" to do it.
// Replaces the browser's confirm dialog so the page never blocks.
export function ConfirmButton({
  label,
  question,
  confirmLabel,
  onConfirm,
}: {
  label: string;
  question: string;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
}) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const wasAsking = useRef(false);

  // keep keyboard focus sensible: onto Confirm when the question appears, back to the trigger after
  useEffect(() => {
    if (asking) confirmRef.current?.focus();
    else if (wasAsking.current) triggerRef.current?.focus();
    wasAsking.current = asking;
  }, [asking]);

  if (!asking) {
    return (
      <button ref={triggerRef} type="button" onClick={() => setAsking(true)}>
        {label}
      </button>
    );
  }
  return (
    <div role="group" aria-label={question}>
      <p>{question}</p>
      <button
        ref={confirmRef}
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onConfirm();
          } finally {
            setBusy(false);
            setAsking(false);
          }
        }}
      >
        {busy ? "Working…" : confirmLabel}
      </button>
      <button type="button" onClick={() => setAsking(false)}>
        Cancel
      </button>
    </div>
  );
}
