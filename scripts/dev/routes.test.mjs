import test from "node:test";
import assert from "node:assert/strict";
import { routeFor, safeJoin } from "./routes.mjs";

test("GP paths are forwarded", () => {
  for (const p of ["/_next/static/x.js", "/api/dishes", "/dishes", "/dishes/12", "/ingredients", "/suppliers",
    "/batch-recipes", "/orders", "/locked", "/share/abc", "/favicon.ico"]) {
    assert.deepEqual(routeFor(p), { kind: "gp", path: p }, p);
  }
});

test("/gp and /gp/ are the GP home", () => {
  assert.deepEqual(routeFor("/gp"), { kind: "gp", path: "/" });
  assert.deepEqual(routeFor("/gp/"), { kind: "gp", path: "/" });
});

test("everything else is static", () => {
  for (const p of ["/", "/index.html", "/css/styles.css", "/dishesx", "/ordering"]) {
    assert.deepEqual(routeFor(p), { kind: "static" }, p);
  }
});

test("service worker and config get special handling", () => {
  assert.deepEqual(routeFor("/sw.js"), { kind: "kill-sw" });
  assert.deepEqual(routeFor("/config/config.js"), { kind: "dev-config" });
});

test("safeJoin stays inside the base directory", () => {
  assert.equal(safeJoin("/base/web", "/css/a.css"), "/base/web/css/a.css");
  assert.equal(safeJoin("/base/web", "/"), "/base/web");
  assert.equal(safeJoin("/base/web", "/../secret"), null);
  assert.equal(safeJoin("/base/web", "/%2e%2e/secret"), null);
  assert.equal(safeJoin("/base/web", "/css/../../secret"), null);
  assert.equal(safeJoin("/base/web", "/%E0%A4%A"), null);
  assert.equal(safeJoin("/base/web", "/a%00b"), null);
});
