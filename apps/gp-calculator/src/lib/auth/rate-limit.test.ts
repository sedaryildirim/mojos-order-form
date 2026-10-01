import { describe, expect, it } from "vitest";
import { MAX_FAILURES, WINDOW_MS, checkRateLimit, recordFailure, resetFailures } from "./rate-limit";

describe("login rate limit", () => {
  it("blocks after too many wrong attempts and recovers after the window", () => {
    const key = "1.2.3.4";
    const t0 = 1_000_000;
    for (let i = 0; i < MAX_FAILURES; i++) {
      expect(checkRateLimit(key, t0).allowed).toBe(true);
      recordFailure(key, t0);
    }
    const blocked = checkRateLimit(key, t0 + 1_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(checkRateLimit(key, t0 + WINDOW_MS + 1).allowed).toBe(true);
  });

  it("counts each address separately and resets on success", () => {
    for (let i = 0; i < MAX_FAILURES; i++) recordFailure("a", 5);
    expect(checkRateLimit("a", 6).allowed).toBe(false);
    expect(checkRateLimit("b", 6).allowed).toBe(true);
    resetFailures("a");
    expect(checkRateLimit("a", 6).allowed).toBe(true);
  });
});
