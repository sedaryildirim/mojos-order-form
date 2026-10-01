"use client";

import Link from "next/link";
import { useEffect } from "react";

// Shown when a page fails while loading or rendering. The rest of the app (top bar) stays usable.
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main>
      <h1>Something went wrong</h1>
      <p>This page could not be loaded. Your data is safe. Try again, or go back to the dishes list.</p>
      <div>
        <button type="button" onClick={reset}>
          Try again
        </button>
        <Link href="/dishes">Back to dishes</Link>
      </div>
      {error.digest && <small>Reference: {error.digest}</small>}
    </main>
  );
}
