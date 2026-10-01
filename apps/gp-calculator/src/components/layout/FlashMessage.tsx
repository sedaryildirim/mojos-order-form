"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { takeFlash } from "@/lib/client/flash";

// Shows the message left by the previous screen (for example "Saved Flour") once, under the top bar.
export function FlashMessage() {
  const pathname = usePathname();
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    const flash = takeFlash();
    if (flash) setText(flash);
    else setText(null);
  }, [pathname]);

  useEffect(() => {
    if (!text) return;
    const timer = setTimeout(() => setText(null), 6000);
    return () => clearTimeout(timer);
  }, [text]);

  return (
    <div aria-live="polite">
      {text && (
        <div>
          <div>
            <p>{text}</p>
            <button type="button" onClick={() => setText(null)}>
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
