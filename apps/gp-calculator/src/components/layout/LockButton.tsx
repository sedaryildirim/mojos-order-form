"use client";

// Ends the session: clears the cookie, then reloads so the password screen appears.
export function LockButton() {
  return (
    <button
      type="button"
      title="Lock the calculator"
      onClick={async () => {
        try {
          await fetch("/api/auth/logout", { method: "POST" });
        } finally {
          window.location.assign("/");
        }
      }}
    >
      Lock
    </button>
  );
}
