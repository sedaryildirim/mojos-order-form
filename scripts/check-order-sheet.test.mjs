import test from "node:test";
import assert from "node:assert/strict";
import { checkSheet, parseSheet } from "./check-order-sheet.mjs";

const sheet = (items) => ({ s: { categories: [{ name: "Veg", items }] } });

test("a clean sheet has no problems", () => {
  assert.deepEqual(checkSheet(sheet([{ id: "1", name: "Kale", unit: "Kilogram", price: 70 }])), []);
});

test("flags duplicate ids, bad prices, and missing fields", () => {
  const p = checkSheet(sheet([
    { id: "1", name: "Kale", unit: "Kilogram", price: 70 },
    { id: "1", name: "Cabbage", unit: "Kilogram", price: 40 },
    { id: "2", name: "Mint", unit: "Kilogram", price: "70" },
    { id: "3", name: "", unit: "", price: 5 },
  ]));
  assert.equal(p.length, 4);
  assert.match(p[0], /id 1 is already used by "Kale"/);
  assert.match(p[1], /zero or more/);
});

test("parseSheet reads the JSON after `const DATA =` and refuses anything else", () => {
  assert.deepEqual(parseSheet('const DATA = {"a":1};\n'), { a: 1 });
  assert.throws(() => parseSheet("{}"), /const DATA/);
});
