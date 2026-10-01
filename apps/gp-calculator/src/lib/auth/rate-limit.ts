// Slows down password guessing: a few wrong attempts per address, then a wait.
// In memory, so it resets when the server restarts and is per server instance.
export const MAX_FAILURES = 8;
export const WINDOW_MS = 5 * 60 * 1000;

const failures = new Map<string, number[]>();

function recent(key: string, now: number): number[] {
  const list = (failures.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (list.length) failures.set(key, list);
  else failures.delete(key);
  return list;
}

export function checkRateLimit(key: string, now = Date.now()): { allowed: boolean; retryAfterSeconds: number } {
  const list = recent(key, now);
  if (list.length < MAX_FAILURES) return { allowed: true, retryAfterSeconds: 0 };
  return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((list[0] + WINDOW_MS - now) / 1000)) };
}

export function recordFailure(key: string, now = Date.now()): void {
  failures.set(key, [...recent(key, now), now]);
}

export function resetFailures(key: string): void {
  failures.delete(key);
}
