import { diffVersionLines } from "./diff";
import { expect, test } from "vitest";

const oldLines = [
  { ingredientId: "onion", ingredientNameSnapshot: "Onions", quantity: "250.000", unit: "G" },
  { ingredientId: "cream", ingredientNameSnapshot: "Cream", quantity: "100.000", unit: "ML" },
];

test("flags a removed ingredient", () => {
  const newLines = [oldLines[0]];
  const diff = diffVersionLines(oldLines, newLines);
  expect(diff.find((d) => d.ingredientName === "Cream")).toMatchObject({ status: "removed" });
});

test("flags an added ingredient", () => {
  const newLines = [...oldLines, { ingredientId: "salt", ingredientNameSnapshot: "Salt", quantity: "5.000", unit: "G" }];
  const diff = diffVersionLines(oldLines, newLines);
  expect(diff.find((d) => d.ingredientName === "Salt")).toMatchObject({ status: "added" });
});

test("flags a changed quantity", () => {
  const newLines = [{ ...oldLines[0], quantity: "300.000" }, oldLines[1]];
  const diff = diffVersionLines(oldLines, newLines);
  expect(diff.find((d) => d.ingredientName === "Onions")).toMatchObject({ status: "changed", oldQuantity: "250.000", newQuantity: "300.000" });
});

test("flags an unchanged line", () => {
  const diff = diffVersionLines(oldLines, oldLines);
  expect(diff.every((d) => d.status === "unchanged")).toBe(true);
});

test("pairs duplicate-ingredient lines by position instead of silently dropping the extra one", () => {
  // A dish can legally have the same ingredient on two lines (e.g. Onions
  // diced and Onions whole). Keying the diff by ingredientId alone would let
  // the second old line silently overwrite the first, losing it from the
  // diff entirely instead of reporting it as removed.
  const twoOnionLines = [
    { ingredientId: "onion", ingredientNameSnapshot: "Onions", quantity: "100.000", unit: "G" },
    { ingredientId: "onion", ingredientNameSnapshot: "Onions", quantity: "150.000", unit: "G" },
  ];
  const oneOnionLine = [
    { ingredientId: "onion", ingredientNameSnapshot: "Onions", quantity: "100.000", unit: "G" },
  ];

  const diff = diffVersionLines(twoOnionLines, oneOnionLine);
  const onionDiffs = diff.filter((d) => d.ingredientName === "Onions");

  expect(onionDiffs).toHaveLength(2);
  expect(onionDiffs).toContainEqual(expect.objectContaining({ status: "unchanged", oldQuantity: "100.000", newQuantity: "100.000" }));
  expect(onionDiffs).toContainEqual(expect.objectContaining({ status: "removed", oldQuantity: "150.000" }));
});

test("treats Decimal-like quantity objects with equal toString() as unchanged", () => {
  // Simulates what Prisma returns for @db.Decimal fields: live Decimal object
  // instances rather than plain strings. Two distinct Decimal objects that
  // stringify to the same value must never be reported as "changed" just
  // because they're different object references.
  const decimalOldLines = [
    { ingredientId: "onion", ingredientNameSnapshot: "Onions", quantity: { toString: () => "250.000" } as unknown as string, unit: "G" },
  ];
  const decimalNewLines = [
    { ingredientId: "onion", ingredientNameSnapshot: "Onions", quantity: { toString: () => "250.000" } as unknown as string, unit: "G" },
  ];
  const diff = diffVersionLines(decimalOldLines, decimalNewLines);
  expect(diff.find((d) => d.ingredientName === "Onions")).toMatchObject({ status: "unchanged" });
});
