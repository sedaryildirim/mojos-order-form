import { expect, test } from "vitest";
import { batchPortions } from "./batch-math";

test("a batch counted in portions makes that many portions", () => {
  expect(batchPortions(9, "EACH", null)).toBe(9);
  expect(batchPortions(9, "EACH", 200)).toBe(9);
});

test("a gram batch divides its yield by the portion size", () => {
  expect(batchPortions(1800, "G", 200)).toBe(9);
  expect(batchPortions(2464, "G", 154)).toBe(16);
});

test("without a portion size the count is unknown", () => {
  expect(batchPortions(1800, "G", null)).toBeNull();
  expect(batchPortions(1800, "ML", 0)).toBeNull();
});
