import { NextRequest, NextResponse } from "next/server";
import { decideAccess } from "@/lib/auth/access";
import { authConfig } from "@/lib/auth/config";
import { COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";

// Every page and API route needs a signed-in session, except sign-in itself and the public share links.
// Signed-out page requests are answered with the password screen (same address, so a reload lands back here).
export async function middleware(req: NextRequest) {
  const cfg = authConfig();
  const authenticated = cfg.configured && (await verifySessionToken(req.cookies.get(COOKIE_NAME)?.value, cfg.secret));

  switch (decideAccess(req.nextUrl.pathname, authenticated)) {
    case "allow":
      return NextResponse.next();
    case "deny-api":
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    default: {
      const url = req.nextUrl.clone();
      url.pathname = "/locked";
      url.search = "";
      const res = NextResponse.rewrite(url);
      res.headers.set("x-robots-tag", "noindex");
      res.headers.set("cache-control", "no-store");
      return res;
    }
  }
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
