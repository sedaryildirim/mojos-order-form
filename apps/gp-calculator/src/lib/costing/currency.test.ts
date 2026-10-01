import { formatTHB } from "./currency";
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
