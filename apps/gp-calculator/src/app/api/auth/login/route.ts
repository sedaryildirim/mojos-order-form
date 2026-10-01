import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { authConfig } from "@/lib/auth/config";
import { checkRateLimit, recordFailure, resetFailures } from "@/lib/auth/rate-limit";
import { COOKIE_NAME, createSessionToken } from "@/lib/auth/session";

// Compares via hashes so length differences and early mismatches leak nothing.
function samePassword(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  let diff = 0;
  for (let i = 0; i < ha.length; i++) diff |= ha[i] ^ hb[i];
  return diff === 0;
}

export async function POST(req: NextRequest) {
  const cfg = authConfig();
  if (!cfg.configured) {
    return NextResponse.json({ error: "Sign-in is not set up on this server (GP_PASSWORD and GP_SESSION_SECRET)." }, { status: 503 });
  }

  const client = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const limit = checkRateLimit(client);
  if (!limit.allowed) {
    const minutes = Math.ceil(limit.retryAfterSeconds / 60);
    return NextResponse.json(
      { error: `Too many wrong attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.` },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const body = await req.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";
  if (!samePassword(password, cfg.password)) {
    recordFailure(client);
    return NextResponse.json({ error: "That password is not correct. Try again." }, { status: 401 });
  }

  resetFailures(client);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, await createSessionToken(cfg.secret), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  return res;
}
