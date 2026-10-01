// Placeholder rows shown while a list loads, so the page doesn't jump when the data arrives.
export function ListSkeleton({ label, rows = 6 }: { label: string; rows?: number }) {
  return (
    <div role="status" aria-live="polite">
      <span>{label}</span>
      <div aria-hidden="true">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} />
        ))}
      </div>
    </div>
  );
}

export function LoadError({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <div role="alert">
      <p>Could not load {what}</p>
      <p>Check that the app is still running, then try again.</p>
      <button type="button" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}
