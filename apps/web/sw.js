// Offline support: the whole site is static, so cache it and the app opens with no connection.
// Strategy: stale-while-revalidate for same-origin files (instant load, refreshed in the background).
// After editing config/ or data, reload twice to see the change; bump VERSION to force an immediate refresh.
const VERSION = "mojos-v2";
const SHELL = [
  "./",
  "index.html",
  "css/fonts.css",
  "css/styles.css",
  "fonts/calistoga.woff2",
  "fonts/inter.woff2",
  "fonts/jetbrains-mono.woff2",
  "config/config.js",
  "config/data.js",
  "js/vendor/xlsx.full.min.js",
  "js/ordering/app.js",
  "js/shell/hero-fx.js",
  "js/shell/a11y.js",
  "js/shell/launcher.js",
  "js/shell/scroll-search.js",
  "js/shell/offline.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: true });
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached || (req.mode === "navigate" ? cache.match("index.html") : Response.error()));
      return cached || network;
    })
  );
});
