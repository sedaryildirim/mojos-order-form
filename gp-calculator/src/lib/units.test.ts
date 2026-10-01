import { convert, unitFamily } from "./units";
import { expect, test } from "vitest";

test("converts kg to g", () => {
  expect(convert(2, "KG", "G")).toBe(2000);
});

test("converts g to kg", () => {
  expect(convert(500, "G", "KG")).toBe(0.5);
});

test("converts L to ml", () => {
  expect(convert(1.5, "L", "ML")).toBe(1500);
});

test("converts ml to L", () => {
  expect(convert(1500, "ML", "L")).toBe(1.5);
});

test("same unit passes through unchanged for count", () => {
  expect(convert(10, "EACH", "EACH")).toBe(10);
});

test("same unit passes through unchanged for weight", () => {
  expect(convert(5, "G", "G")).toBe(5);
  expect(convert(3, "KG", "KG")).toBe(3);
});

test("same unit passes through unchanged for volume", () => {
  expect(convert(2, "L", "L")).toBe(2);
  expect(convert(750, "ML", "ML")).toBe(750);
});

test("throws converting across unit families", () => {
  expect(() => convert(10, "G", "EACH")).toThrow(/incompatible units/i);
});

test("throws converting volume to weight", () => {
  expect(() => convert(1, "ML", "KG")).toThrow(/incompatible units/i);
});

test("throws converting volume to count", () => {
  expect(() => convert(1, "L", "EACH")).toThrow(/incompatible units/i);
});

test("unitFamily groups weight units together", () => {
  expect(unitFamily("G")).toBe("weight");
  expect(unitFamily("KG")).toBe("weight");
  expect(unitFamily("ML")).toBe("volume");
  expect(unitFamily("EACH")).toBe("count");
});
