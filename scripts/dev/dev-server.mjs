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
    cwd: gpDir, stdio: "inherit", env: { ...process.env, NEXT_PUBLIC_HOME_URL: "/", NEXT_PUBLIC_GP_HOME_URL: "/gp" }
  });
  gp.on("exit", (code) => {
    if (code) console.error(`GP app exited with code ${code}. Run "npm run setup" if dependencies are missing.`);
    gp = null;
    shutdown();
  });
});
