// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createSessionToken, verifySessionToken } from "./session";

const SECRET = "test-secret";

describe("session tokens", () => {
  it("accepts a fresh token", async () => {
    expect(await verifySessionToken(await createSessionToken(SECRET), SECRET)).toBe(true);
  });

  it("rejects a token signed with another secret", async () => {
    expect(await verifySessionToken(await createSessionToken("other"), SECRET)).toBe(false);
  });

  it("rejects a tampered expiry or signature", async () => {
    const token = await createSessionToken(SECRET, 1_000, 60_000);
    const [exp, sig] = token.split(".");
    expect(await verifySessionToken(`${Number(exp) + 1}.${sig}`, SECRET, 2_000)).toBe(false);
    expect(await verifySessionToken(`${exp}.${sig}x`, SECRET, 2_000)).toBe(false);
  });

  it("rejects an expired token", async () => {
    const token = await createSessionToken(SECRET, 1_000, 60_000);
    expect(await verifySessionToken(token, SECRET, 1_000 + 60_001)).toBe(false);
    expect(await verifySessionToken(token, SECRET, 1_000 + 59_000)).toBe(true);
  });

  it("rejects missing, empty or malformed tokens", async () => {
    for (const bad of [undefined, "", "abc", "1.2.3", ".sig", "123."]) {
      expect(await verifySessionToken(bad, SECRET)).toBe(false);
    }
    expect(await verifySessionToken(await createSessionToken(SECRET), "")).toBe(false);
  });
});
