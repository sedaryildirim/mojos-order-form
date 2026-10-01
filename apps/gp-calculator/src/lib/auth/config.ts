// Sign-in settings, read from the environment.
//   GP_PASSWORD         the shared password
//   GP_SESSION_SECRET   long random string used to sign the session cookie
// In development both fall back to temporary values so the app runs out of the box (password 555666).
// In production there are NO fallbacks: without both variables nobody can sign in (fail closed).
const DEV_PASSWORD = "555666"; // TEMPORARY
const DEV_SECRET = "dev-only-secret-not-for-production";

export function authConfig() {
  const production = process.env.NODE_ENV === "production";
  const password = process.env.GP_PASSWORD || (production ? "" : DEV_PASSWORD);
  const secret = process.env.GP_SESSION_SECRET || (production ? "" : DEV_SECRET);
  return { password, secret, configured: Boolean(password && secret) };
}
