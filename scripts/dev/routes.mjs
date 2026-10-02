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
