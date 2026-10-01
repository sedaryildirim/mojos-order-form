"use client";

// Last resort: the layout itself failed, so this page brings its own <html>.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", background: "#0B1120", color: "#F1F5F9" }}>
        <h1>Something went wrong</h1>
        <p>The calculator could not start. Try again; if it keeps happening, restart the app.</p>
        <button type="button" onClick={reset} style={{ padding: "0.75rem 1.25rem" }}>
          Try again
        </button>
      </body>
    </html>
  );
}
