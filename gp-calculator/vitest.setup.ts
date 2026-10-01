import { config } from "dotenv";
config({ path: ".env.test" });

// Safety guard: the test suite's afterEach hooks wipe tables with deleteMany().
// If DATABASE_URL isn't pointed at the dedicated test database, running the
// suite would silently destroy dev data. Fail loudly instead.
if (!process.env.DATABASE_URL?.includes("_test")) {
  throw new Error(
    `Refusing to run tests: DATABASE_URL does not look like a test database (must contain "_test"). ` +
      `Got: ${process.env.DATABASE_URL ?? "(unset)"}. Check .env.test.`
  );
}

import "@testing-library/jest-dom/vitest";
