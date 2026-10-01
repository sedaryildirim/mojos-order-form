import { describe, expect, it } from "vitest";
import { decideAccess } from "./access";

describe("decideAccess", () => {
  it("lets a signed-in user through everywhere", () => {
    expect(decideAccess("/dishes", true)).toBe("allow");
    expect(decideAccess("/api/dishes", true)).toBe("allow");
  });

  it("shows the password screen for signed-out pages", () => {
    expect(decideAccess("/", false)).toBe("lock-page");
    expect(decideAccess("/dishes/abc", false)).toBe("lock-page");
  });

  it("refuses signed-out API calls", () => {
    expect(decideAccess("/api/dishes", false)).toBe("deny-api");
    expect(decideAccess("/api/ingredients/export", false)).toBe("deny-api");
    expect(decideAccess("/api/authors", false)).toBe("deny-api"); // only /api/auth/ is public, not look-alikes
  });

  it("keeps sign-in, the locked screen and share links public", () => {
    expect(decideAccess("/api/auth/login", false)).toBe("allow");
    expect(decideAccess("/api/auth/logout", false)).toBe("allow");
    expect(decideAccess("/locked", false)).toBe("allow");
    expect(decideAccess("/share/some-token", false)).toBe("allow");
    expect(decideAccess("/_next/static/x.js", false)).toBe("allow");
  });
});
