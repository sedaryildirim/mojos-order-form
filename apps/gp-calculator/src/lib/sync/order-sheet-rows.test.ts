import { describe, expect, it } from "vitest";
import { buildRows, parseOrderSheet, SYNCED_SUPPLIERS } from "./order-sheet-rows";

const sheet = (extra: Record<string, unknown> = {}) =>
  `const DATA = ${JSON.stringify({
    "makro-kaif": {
      categories: [
        { name: "Vegetables", items: [{ id: "135318", name: "Cauliflower White 1 kg", unit: "Kilogram", price: 85, par: null }] },
        { name: "Dry", items: [{ id: "184634", name: "KITE Wheat Flour 1 kg", unit: "EACH", price: 37, par: null }, { id: "1", name: "Free thing", unit: "EACH", price: 0, par: null }] },
      ],
    },
    "makro-samui": { categories: [{ name: "Vegetables", items: [{ id: "9", name: "Samui only", unit: "EACH", price: 10, par: null }] }] },
    ...extra,
  })};`;

describe("parseOrderSheet", () => {
  it("reads `const DATA = {...};` as JSON", () => {
    expect(Object.keys(parseOrderSheet(sheet()))).toContain("makro-kaif");
  });
  it("refuses text that is not an order sheet, with a clear message", () => {
    expect(() => parseOrderSheet("hello")).toThrow(/Could not read the order sheet/);
    expect(() => parseOrderSheet("const DATA = {};")).toThrow(/Could not read the order sheet/);
    expect(() => parseOrderSheet("const DATA = {oops};")).toThrow(/Could not read the order sheet/);
  });
  it("never executes the file", () => {
    (globalThis as Record<string, unknown>).__orderSheetRan = undefined;
    parseOrderSheet('globalThis.__orderSheetRan = true; const DATA = {"a":{"categories":[]}};');
    expect((globalThis as Record<string, unknown>).__orderSheetRan).toBeUndefined();
  });
});

describe("buildRows", () => {
  const rows = buildRows(parseOrderSheet(sheet()), {});
  it("builds a row per priced Kaif item with a sourceKey, supplier, unit and pack", () => {
    expect(rows).toContainEqual({
      sourceKey: "makro-kaif:135318", name: "Cauliflower White 1 kg", category: "Vegetables", supplier: "Makro",
      purchaseUnit: "G", packQuantity: 1000, packPrice: 85, needsPackSize: false,
    });
    expect(rows.find((r) => r.sourceKey === "makro-kaif:184634")).toMatchObject({ purchaseUnit: "G", packQuantity: 1000, packPrice: 37 });
  });
  it("skips suppliers that are not Kaif's and items without a price", () => {
    expect(rows.map((r) => r.sourceKey)).toEqual(["makro-kaif:135318", "makro-kaif:184634"]);
    expect(Object.keys(SYNCED_SUPPLIERS)).not.toContain("makro-samui");
  });
  it("applies a pack-size override keyed by sourceKey", () => {
    const r = buildRows(parseOrderSheet(sheet()), { "makro-kaif:184634": { purchaseUnit: "EACH", packQuantity: 12 } });
    expect(r.find((x) => x.sourceKey === "makro-kaif:184634")).toMatchObject({ purchaseUnit: "EACH", packQuantity: 12, needsPackSize: false });
  });
});
