import { afterEach, describe, expect, it, vi } from "vitest";

async function load() {
  vi.resetModules();
  return import("./site");
}

afterEach(() => vi.unstubAllEnvs());

describe("GP_HOME_URL", () => {
  it("is the site root by default, so production links are unchanged", async () => {
    vi.stubEnv("NEXT_PUBLIC_GP_HOME_URL", "");
    expect((await load()).GP_HOME_URL).toBe("/");
  });

  it("can be overridden, as the one-port dev server does with /gp", async () => {
    vi.stubEnv("NEXT_PUBLIC_GP_HOME_URL", "/gp");
    expect((await load()).GP_HOME_URL).toBe("/gp");
  });
});
