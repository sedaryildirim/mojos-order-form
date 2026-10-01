"use client";

import { useState } from "react";
import { safeFetch, apiError } from "@/lib/client/api";

export function EmailShareForm({ versionId }: { versionId: string }) {
  const [to, setTo] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSend() {
    setStatus("sending");
    const res = await safeFetch(`/api/dish-versions/${versionId}/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to }),
    });
    if (res.ok) {
      setStatus("sent");
      return;
    }
    setErrorMessage(res.status === 400 ? "Enter a valid email address." : await apiError(res, "Could not send the email. Please try again."));
    setStatus("error");
  }

  return (
    <div>
      <input type="email" placeholder="recipient@example.com" value={to} onChange={(e) => setTo(e.target.value)} />
      <button onClick={handleSend} disabled={status === "sending"}>
        {status === "sending" ? "Sending…" : "Email spec sheet"}
      </button>
      {status === "sent" && <span>Sent.</span>}
      {status === "error" && <span>{errorMessage}</span>}
    </div>
  );
}
