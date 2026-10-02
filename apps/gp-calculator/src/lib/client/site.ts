// Where the Mojos + Kaif launcher menu lives (the static ordering site). Override per environment with
// NEXT_PUBLIC_HOME_URL, for example http://localhost:8080/ when serving the site locally.
export const HOME_URL = process.env.NEXT_PUBLIC_HOME_URL || "https://sedaryildirim.github.io/mojos-order-form/";

// The GP Calculator's own home page. "/" in production; the one-port dev server serves the launcher at "/"
// and sets NEXT_PUBLIC_GP_HOME_URL=/gp, so the logo stays inside the GP app.
export const GP_HOME_URL = process.env.NEXT_PUBLIC_GP_HOME_URL || "/";
