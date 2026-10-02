import { formatTHB, formatTHBText } from "./currency";
import { expect, test } from "vitest";

test("formats whole numbers with thousands separators and 2 decimals", () => {
  expect(formatTHB(1250)).toBe("฿1,250.00");
});

test("rounds to 2 decimal places", () => {
  expect(formatTHB(99.999)).toBe("฿100.00");
});

test("formats zero", () => {
  expect(formatTHB(0)).toBe("฿0.00");
});

// PDFs use built-in fonts that have no baht glyph (it prints as "?"), so they use the plain-text form.
test("formatTHBText spells the currency as THB and never uses the baht symbol", () => {
  expect(formatTHBText(1250)).toBe("THB 1,250.00");
  expect(formatTHBText(99.999)).toBe("THB 100.00");
  expect(formatTHBText(0)).toBe("THB 0.00");
  expect(formatTHBText(81.8)).not.toContain("฿");
});
