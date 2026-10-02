# mojos-kaif-master-folder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move `~/mojos-order-form` to `~/mojos-kaif-master-folder`, make it self-contained and easy to run, and add one command that serves everything on one local port.

**Architecture:** One `mv` of the whole repo (history, ignored files, `.env*` and `data/` travel with it). A dependency-free Node "front door" (`scripts/dev/dev-server.mjs`) serves `apps/web` statically on 8080 and forwards the GP app's own paths to a Next.js dev server it starts on an internal port. Production hosting and the GP `basePath` are unchanged.

**Tech Stack:** Node 24 (`node:http`, `node:net`, `node:test`), bash, Next.js 14 dev server, npm.

**Spec:** `docs/superpowers/specs/2026-10-02-mojos-kaif-master-folder-design.md` (in the new folder after Task 1). One deliberate change from the spec: the internal GP port is **3410**, not 3000, so it cannot collide with other apps that hold 3000.

## Global Constraints

- Move, not copy: `~/mojos-order-form` must not exist afterwards.
- Never push to GitHub. Do not touch `~/mojos-combined`, `~/mojos-kaif-platform`, `~/gp-calculator` or any database.
- Keep `apps/web` and `apps/gp-calculator` names; do not change the GP app's `basePath` or any production code in `apps/`.
- No new npm dependencies anywhere. The front door uses only Node built-ins.
- Kill processes by port only (8080, 3410, and 3000 once for the old server); never `pkill` by name.
- Work on branch `master-folder` (created in Task 1); leave `master` untouched.
- Commit trailer on every commit: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Use absolute paths in commands after Task 1 starts (the shell's current directory disappears during the move).

## Review Focus

- `/../` or encoded traversal in a static URL must give 404, never a file outside `apps/web` (tested in Task 2).
- Requests arriving before the GP app has finished starting must get a readable 502 page, not a crash (Task 3).
- Query strings must survive the forward to the GP app (Task 3).
- A service worker registered earlier on `localhost:8080` must not keep serving stale or GP pages from cache (Task 3, kill-switch).
- `npm run stop` must not touch anything on other ports (Task 4).
- Port 8080 already in use must exit with a clear message and non-zero status (Task 3).

---

### Task 1: Stop servers, move the folder, make it self-contained

**Files:**
- Move: `/Users/sedaryildirim/mojos-order-form` to `/Users/sedaryildirim/mojos-kaif-master-folder`
- Move in: the spec and this plan to `docs/superpowers/specs/` and `docs/superpowers/plans/`
- Replace: `apps/gp-calculator/node_modules` (symlink) with a real install

**Interfaces:**
- Produces: `/Users/sedaryildirim/mojos-kaif-master-folder` as a git repo on branch `master-folder`, with real `node_modules` in `apps/gp-calculator`.

- [ ] **Step 1: Confirm the two servers belong to the old folder, then stop them by port**

```bash
lsof -a -d cwd -p "$(lsof -ti tcp:3000 -sTCP:LISTEN | head -1)" | tail -1
lsof -ti tcp:8080 -sTCP:LISTEN
```
Expected: the 3000 listener's cwd is `/Users/sedaryildirim/mojos-order-form/apps/gp-calculator`; one PID listens on 8080. Then:
```bash
kill $(lsof -ti tcp:3000 -sTCP:LISTEN) $(lsof -ti tcp:8080 -sTCP:LISTEN)
sleep 2; lsof -i :3000 -i :8080 | wc -l
```
Expected: `0`.

- [ ] **Step 2: Confirm git is clean, then move**

```bash
git -C /Users/sedaryildirim/mojos-order-form status --short | wc -l   # expect 0
test ! -e /Users/sedaryildirim/mojos-kaif-master-folder && mv /Users/sedaryildirim/mojos-order-form /Users/sedaryildirim/mojos-kaif-master-folder
ls -d /Users/sedaryildirim/mojos-order-form 2>&1   # expect: No such file or directory
```

- [ ] **Step 3: Create the working branch and bring the spec and plan in**

```bash
cd /Users/sedaryildirim/mojos-kaif-master-folder
git checkout -b master-folder
mkdir -p docs/superpowers/specs docs/superpowers/plans
S=/private/tmp/claude-501/-Users-sedaryildirim/85cc1d08-c7dd-44b0-9fbc-e9ca6104eb45/scratchpad
cp $S/2026-10-02-mojos-kaif-master-folder-design.md docs/superpowers/specs/
cp $S/2026-10-02-mojos-kaif-master-folder-plan.md docs/superpowers/plans/
```

- [ ] **Step 4: Replace the symlinked node_modules with a real install**

```bash
cd /Users/sedaryildirim/mojos-kaif-master-folder/apps/gp-calculator
test -L node_modules && rm node_modules      # removes the symlink only, never the target
npm ci
test -x node_modules/.bin/next && test ! -L node_modules && echo OK
```
Expected: `OK`. If `npm ci` fails on the `xlsx` tarball URL, report the error and stop; do not fall back to the symlink.

- [ ] **Step 5: Commit**

```bash
cd /Users/sedaryildirim/mojos-kaif-master-folder
git add docs/superpowers
git commit -m "docs: add master-folder spec and plan

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Routing rules for the front door (TDD)

**Files:**
- Create: `scripts/dev/routes.mjs`
- Test: `scripts/dev/routes.test.mjs`

**Interfaces:**
- Produces:
  - `routeFor(pathname: string): { kind: "gp", path: string } | { kind: "static" } | { kind: "kill-sw" } | { kind: "dev-config" }`
  - `safeJoin(baseDir: string, urlPath: string): string | null` (absolute file path inside `baseDir`, or `null` if it would escape or the path is malformed)

- [ ] **Step 1: Write the failing test**

```js
// scripts/dev/routes.test.mjs
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd /Users/sedaryildirim/mojos-kaif-master-folder && node --test 'scripts/dev/*.test.mjs'`
Expected: FAIL, `Cannot find module './routes.mjs'`.

- [ ] **Step 3: Write the implementation**

```js
// scripts/dev/routes.mjs
import path from "node:path";

// Paths owned by the GP Next.js app. Everything else is the static site in apps/web.
const GP_PREFIXES = ["/_next", "/api", "/dishes", "/ingredients", "/suppliers", "/batch-recipes", "/orders", "/locked", "/share", "/favicon.ico"];

export function routeFor(pathname) {
  if (pathname === "/sw.js") return { kind: "kill-sw" };
  if (pathname === "/config/config.js") return { kind: "dev-config" };
  if (pathname === "/gp" || pathname === "/gp/") return { kind: "gp", path: "/" };
  if (GP_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) return { kind: "gp", path: pathname };
  return { kind: "static" };
}

// Resolve a URL path to a file under baseDir. Returns null for anything that escapes it or is malformed.
export function safeJoin(baseDir, urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  if (decoded.includes("\0") || decoded.split("/").includes("..")) return null;
  const resolved = path.resolve(baseDir, "." + path.posix.normalize("/" + decoded));
  const base = path.resolve(baseDir);
  return resolved === base || resolved.startsWith(base + path.sep) ? resolved : null;
}
```


- [ ] **Step 4: Run the tests**

Run: `node --test 'scripts/dev/*.test.mjs'`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/dev/routes.mjs scripts/dev/routes.test.mjs
git commit -m "feat(dev): routing rules for the one-port dev server

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The one-port dev server

**Files:**
- Create: `scripts/dev/dev-server.mjs`

**Interfaces:**
- Consumes: `routeFor`, `safeJoin` from `./routes.mjs`.
- Produces: a process listening on `PORT` (default 8080) that serves `apps/web`, forwards GP paths to `GP_PORT` (default 3410), and starts and stops the Next.js dev server itself. Env `GP=off` skips the GP app (static only).

- [ ] **Step 1: Write the server**

```js
// scripts/dev/dev-server.mjs
// One local port for everything: static site at /, GP app (Next.js) at /gp and its own paths.
import http from "node:http";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { routeFor, safeJoin } from "./routes.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const webDir = path.join(root, "apps/web");
const gpDir = path.join(root, "apps/gp-calculator");
const PORT = Number(process.env.PORT || 8080);
const GP_PORT = Number(process.env.GP_PORT || 3410);
const GP_ON = process.env.GP !== "off";

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".woff2": "font/woff2", ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".md": "text/plain; charset=utf-8"
};

// Earlier visits to this origin may have registered the site's offline service worker, which would
// answer GP pages from its cache. Locally we serve a worker that removes itself and its caches.
const KILL_SW = `self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",(e)=>e.waitUntil(caches.keys().then((k)=>Promise.all(k.map((x)=>caches.delete(x))))
  .then(()=>self.registration.unregister()).then(()=>self.clients.matchAll()).then((cs)=>cs.forEach((c)=>c.navigate(c.url)))));`;

function send(res, status, type, body) {
  res.writeHead(status, { "content-type": type, "cache-control": "no-store" });
  res.end(body);
}

function serveStatic(res, urlPath) {
  let file = safeJoin(webDir, urlPath);
  if (file && fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!file || !fs.existsSync(file)) return send(res, 404, "text/plain; charset=utf-8", "Not found");
  res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
  fs.createReadStream(file).pipe(res);
}

// Locally the launcher's Kaif GP card should open the GP app on this same port.
function serveDevConfig(res) {
  const src = fs.readFileSync(path.join(webDir, "config/config.js"), "utf8");
  send(res, 200, TYPES[".js"], src.replace(/(kaifGp:\s*\{\s*url:\s*)"[^"]*"/, '$1"/gp"'));
}

function forward(req, res, gpPath, search) {
  const up = http.request({ host: "127.0.0.1", port: GP_PORT, method: req.method, path: gpPath + search, headers: req.headers }, (r) => {
    res.writeHead(r.statusCode, r.headers);
    r.pipe(res);
  });
  up.on("error", () => send(res, 502, "text/html; charset=utf-8",
    "<h1>The GP app is still starting</h1><p>Give it a few seconds and reload.</p>"));
  req.pipe(up);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const route = routeFor(url.pathname);
  if (route.kind === "kill-sw") return send(res, 200, TYPES[".js"], KILL_SW);
  if (route.kind === "dev-config") return serveDevConfig(res);
  if (route.kind === "gp") {
    if (!GP_ON) return send(res, 404, "text/plain; charset=utf-8", "GP app is off (started with GP=off)");
    return forward(req, res, route.path, url.search);
  }
  return serveStatic(res, url.pathname);
});

// Next's dev server pushes hot reloads over a websocket on /_next/webpack-hmr.
server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url, "http://localhost");
  if (!GP_ON || routeFor(url.pathname).kind !== "gp") return socket.destroy();
  const up = net.connect(GP_PORT, "127.0.0.1", () => {
    let raw = `${req.method} ${req.url} HTTP/1.1\r\n`;
    for (let i = 0; i < req.rawHeaders.length; i += 2) raw += `${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}\r\n`;
    up.write(raw + "\r\n");
    up.write(head);
    socket.pipe(up).pipe(socket);
  });
  up.on("error", () => socket.destroy());
  socket.on("error", () => up.destroy());
});

server.on("error", (err) => {
  console.error(err.code === "EADDRINUSE" ? `Port ${PORT} is already in use. Run "npm run stop", or start with PORT=<other>.` : err.message);
  process.exit(1);
});

let gp = null;
function shutdown() {
  if (gp) gp.kill("SIGTERM");
  server.close();
  setTimeout(() => process.exit(0), 500).unref();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

server.listen(PORT, () => {
  console.log(`\n  Mojo's + Kaif   http://localhost:${PORT}`);
  console.log(`  Ordering form   http://localhost:${PORT}/`);
  console.log(GP_ON ? `  GP Calculator   http://localhost:${PORT}/gp   (Next.js on :${GP_PORT})\n` : "  GP Calculator   off (GP=off)\n");
  if (!GP_ON) return;
  gp = spawn(path.join(gpDir, "node_modules/.bin/next"), ["dev", "-p", String(GP_PORT)], {
    cwd: gpDir, stdio: "inherit", env: { ...process.env, NEXT_PUBLIC_HOME_URL: "/" }
  });
  gp.on("exit", (code) => {
    if (code) console.error(`GP app exited with code ${code}. Run "npm run setup" if dependencies are missing.`);
    gp = null;
    shutdown();
  });
});
```

- [ ] **Step 2: Start it and check every route kind**

```bash
cd /Users/sedaryildirim/mojos-kaif-master-folder
node scripts/dev/dev-server.mjs > /private/tmp/claude-501/-Users-sedaryildirim/85cc1d08-c7dd-44b0-9fbc-e9ca6104eb45/scratchpad/dev.log 2>&1 &
sleep 12
for p in / /css/styles.css /gp /dishes /api/does-not-exist "/gp?x=1" /sw.js /../.env /%2e%2e/.env; do
  printf "%-26s" "$p"; curl -s -o /dev/null -w "%{http_code}\n" --path-as-is "http://localhost:8080$p"; done
curl -s http://localhost:8080/config/config.js | grep -n 'kaifGp'
curl -s http://localhost:8080/sw.js | head -c 60; echo
```
Expected: `/` 200, `/css/styles.css` 200, `/gp` 200 (the GP password screen), `/dishes` 200 (password screen), `/api/does-not-exist` 401 or 404 (from the GP app, not 502), `/sw.js` 200, `/../.env` and `/%2e%2e/.env` 404, the config line shows `url: "/gp"`, and the sw.js body starts with the `self.addEventListener("install"` kill-switch. Stop with `kill %1` afterwards.

- [ ] **Step 3: Check the failure modes**

```bash
# port in use: start two
node scripts/dev/dev-server.mjs & sleep 8; node scripts/dev/dev-server.mjs; echo "exit=$?"
```
Expected: second instance prints `Port 8080 is already in use...` and `exit=1`. Then stop the first: `kill %1`.
Before the GP app is ready (first second after start), `curl -i http://localhost:8080/gp` should return `502` with the "still starting" page, not hang or crash.

- [ ] **Step 4: Commit**

```bash
git add scripts/dev/dev-server.mjs
git commit -m "feat(dev): one-port dev server for the site and GP app

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Root commands, setup and stop

**Files:**
- Create: `package.json`, `scripts/setup.sh`, `scripts/stop.sh`
- Modify: `scripts/dev.sh` (replace contents)

**Interfaces:**
- Consumes: `scripts/dev/dev-server.mjs`, `apps/gp-calculator` npm scripts (`test`, `build`, `backup`).
- Produces: `npm run setup | dev | dev:web | stop | test | build | backup` from the repo root.

- [ ] **Step 1: Write the root package.json (no dependencies)**

```json
{
  "name": "mojos-kaif-master",
  "private": true,
  "description": "Mojo's + Kaif: ordering site and GP Calculator. Run `npm run dev` for everything on http://localhost:8080.",
  "scripts": {
    "setup": "bash scripts/setup.sh",
    "dev": "node scripts/dev/dev-server.mjs",
    "dev:web": "GP=off node scripts/dev/dev-server.mjs",
    "stop": "bash scripts/stop.sh",
    "test": "node --test 'scripts/dev/*.test.mjs' && npm --prefix apps/gp-calculator test",
    "build": "npm --prefix apps/gp-calculator run build",
    "backup": "npm --prefix apps/gp-calculator run backup"
  }
}
```

- [ ] **Step 2: Write setup.sh**

```bash
#!/usr/bin/env bash
# One-time (and after-pulling) setup: dependencies, env file, database check.
set -euo pipefail
cd "$(dirname "$0")/../apps/gp-calculator"

command -v node >/dev/null || { echo "Node.js is required (https://nodejs.org)"; exit 1; }

# An old checkout symlinked node_modules to another folder; replace it with a real install.
[ -L node_modules ] && rm node_modules
npm ci
npx prisma generate

if [ ! -f .env ] && [ ! -f .env.local ]; then
  cp .env.example .env
  echo "Created apps/gp-calculator/.env from .env.example: set DATABASE_URL in it."
fi

if command -v pg_isready >/dev/null && pg_isready -q; then echo "Postgres: accepting connections"; else echo "Postgres: NOT reachable. Start it before running the GP app."; fi
echo "Setup done. Run: npm run dev"
```

- [ ] **Step 3: Write stop.sh and replace dev.sh**

```bash
#!/usr/bin/env bash
# Stops the one-port dev server (8080) and its GP app (3410). Touches only those two ports.
for port in 8080 3410; do
  pids=$(lsof -ti tcp:"$port" -sTCP:LISTEN 2>/dev/null || true)
  if [ -n "$pids" ]; then kill $pids && echo "Stopped port $port (pid $pids)"; else echo "Port $port: nothing running"; fi
done
```
```bash
#!/usr/bin/env bash
# Kept for habit: same as `npm run dev`.
cd "$(dirname "$0")/.." && exec node scripts/dev/dev-server.mjs
```

- [ ] **Step 4: Verify the commands**

```bash
cd /Users/sedaryildirim/mojos-kaif-master-folder && chmod +x scripts/*.sh
npm run dev > /private/tmp/claude-501/-Users-sedaryildirim/85cc1d08-c7dd-44b0-9fbc-e9ca6104eb45/scratchpad/dev.log 2>&1 &
sleep 12; curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/gp
npm run stop; sleep 2; lsof -i :8080 -i :3410 | wc -l
npm run stop
```
Expected: `200`; `npm run stop` prints `Stopped port 8080 ...` and `Stopped port 3410 ...`; the count is `0`; the second `npm run stop` prints `nothing running` twice. Also confirm a listener on an unrelated port (e.g. `python3 -m http.server 8765 &`) survives `npm run stop`, then kill it by its PID.

- [ ] **Step 5: Commit**

```bash
git add package.json scripts/setup.sh scripts/stop.sh scripts/dev.sh
git commit -m "feat: root commands for setup, dev, stop, test, build, backup

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Docs and paths for the new location

**Files:**
- Modify: `README.md`, `docs/deployment.md`, `docs/architecture.md`, `apps/gp-calculator/README.md`, `apps/web/README.md`, `.claude/launch.json` (git-ignored, edit in place)
- Do not modify: `apps/web/config/config.js` (its `localhost:3000` is the production-default launcher link; the dev server rewrites it on the fly), `apps/gp-calculator/src/lib/client/site.ts` (the GitHub Pages URL is the real site address).

- [ ] **Step 1: Rewrite the README "Run locally" and map sections**

In `README.md`, replace the "Run locally" block with:

````markdown
## Run locally

```bash
npm run setup     # once: installs the GP app's dependencies, creates its .env, checks Postgres
npm run dev       # everything on http://localhost:8080  (site at /, GP Calculator at /gp)
npm run stop      # stops it
```

`npm run dev:web` serves only the static site (no database needed). `npm test`, `npm run build` and `npm run backup` run the GP app's commands from the root. The GP Calculator needs Postgres and a `DATABASE_URL` in `apps/gp-calculator/.env`.
````

Update the repository map to list `package.json` (root commands) and `scripts/` as `setup.sh, dev.sh, stop.sh, dev/ (the one-port dev server)`, and add a line under "Run locally" that the folder is `mojos-kaif-master-folder`.

- [ ] **Step 2: Fix the other docs and launch config**

- `docs/architecture.md`: add a short "Local development" section: one port, the front door forwards GP paths to Next.js on :3410, production is unchanged.
- `apps/gp-calculator/README.md` and `apps/web/README.md`: change any `localhost:3000`/`:8080` run instructions to point at `npm run dev` from the repo root (grep first: `grep -n "localhost\|dev.sh" apps/*/README.md`).
- `.claude/launch.json`: set the single configuration to `{"name": "mojos-kaif", "runtimeExecutable": "npm", "runtimeArgs": ["run", "dev"], "port": 8080}`.
- Leave `docs/gp-calculator/superpowers/plans/*` as historical records.

- [ ] **Step 3: Check nothing still points at the old folder**

```bash
cd /Users/sedaryildirim/mojos-kaif-master-folder
grep -rIn "/Users/sedaryildirim/mojos-order-form\|~/mojos-order-form" . --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git
```
Expected: no output. (The repo name `mojos-order-form` inside the GitHub Pages URL and the git remote is correct and stays.)

- [ ] **Step 4: Commit**

```bash
git add README.md docs apps/gp-calculator/README.md apps/web/README.md
git commit -m "docs: update run instructions and layout for the master folder

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: End-to-end verification

**Files:** none changed unless a check fails.

- [ ] **Step 1: Run the tests**

Run: `cd /Users/sedaryildirim/mojos-kaif-master-folder && npm test`
Expected: dev-server tests pass, then the GP Vitest suite. Report the pass/fail counts as printed. If GP tests fail, say which and whether they also fail on the untouched code (`git stash` is not needed: no `apps/` code was changed).

- [ ] **Step 2: Run the real flow from a clean start**

```bash
npm run dev > /private/tmp/claude-501/-Users-sedaryildirim/85cc1d08-c7dd-44b0-9fbc-e9ca6104eb45/scratchpad/dev.log 2>&1 &
sleep 12
curl -s http://localhost:8080/ | grep -c "<html"
curl -s -o /dev/null -w "gp:%{http_code}\n" http://localhost:8080/gp
```
Then sign in to the GP app with a script (`curl -c jar -d` against its sign-in route, using the dev fallback password documented in `.env.example`), request `/dishes` with the cookie and confirm it returns 200 with real database content. If sign-in cannot be scripted, say so and only report what was verified.

- [ ] **Step 3: Open it in a browser and check the two limits from the spec**

Use the browser tools: load `http://localhost:8080/`, click the Kaif GP card (should land on `/gp`), click "All tools" (should land on `/`), and confirm the page is not served by the old service worker (DevTools Application tab, or `navigator.serviceWorker.getRegistrations()` returns an empty list after a reload).

- [ ] **Step 4: Stop everything and report**

```bash
npm run stop; lsof -i :8080 -i :3410 | wc -l   # expect 0
git status --short | wc -l                      # expect 0
git log --oneline -6
```
Report to the owner: what passed, what did not, that nothing was pushed, that `~/mojos-order-form` is gone, and that the other folders are untouched.
