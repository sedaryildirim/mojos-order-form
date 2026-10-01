// Which requests need a signed-in session. Pure so it can be tested without a server.
const PUBLIC_PREFIXES = ["/api/auth/", "/share/", "/_next/", "/locked"];
const PUBLIC_EXACT = ["/favicon.ico"];

export type Access = "allow" | "lock-page" | "deny-api";

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_EXACT.includes(pathname) || PUBLIC_PREFIXES.some((p) => pathname === p.replace(/\/$/, "") || pathname.startsWith(p));
}

export function decideAccess(pathname: string, authenticated: boolean): Access {
  if (authenticated || isPublicPath(pathname)) return "allow";
  return pathname.startsWith("/api/") ? "deny-api" : "lock-page";
}
