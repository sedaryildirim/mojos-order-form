import { describe, expect, it } from "vitest";
import { parseFoodBible, parseLine } from "./food-bible-parse";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const one = (phrase: string, quantity: number, unit: string) => ({ phrase, quantity, unit });

describe("parseLine", () => {
  it("reads grams, counts and litres", () => {
    expect(parseLine("120g plain toast").options).toEqual([[one("plain toast", 120, "G")]]);
    expect(parseLine("2 eggs").options).toEqual([[one("eggs", 2, "EACH")]]);
    expect(parseLine("1 big bun").options).toEqual([[one("big bun", 1, "EACH")]]);
    expect(parseLine("1L whipping cream").options).toEqual([[one("whipping cream", 1, "L")]]);
    expect(parseLine("0.5kg flour").options).toEqual([[one("flour", 0.5, "KG")]]);
  });

  it("ignores how an item is prepared", () => {
    expect(parseLine("1 egg, scrambled").options).toEqual([[one("egg", 1, "EACH")]]);
    expect(parseLine("2 eggs, poached").options).toEqual([[one("eggs", 2, "EACH")]]);
    expect(parseLine("30g cucumber, shaved").options).toEqual([[one("cucumber", 30, "G")]]);
    expect(parseLine("580g potato, boiled, skin off").options).toEqual([[one("potato", 580, "G")]]);
    expect(parseLine("15g parmesan (finely grated)").options).toEqual([[one("parmesan", 15, "G")]]);
    expect(parseLine("200g potatoes (fries)").options).toEqual([[one("potatoes", 200, "G")]]);
  });

  it("a comma list means the stated weight of EACH item", () => {
    expect(parseLine("30g bell pepper, carrot").options).toEqual([[one("bell pepper", 30, "G"), one("carrot", 30, "G")]]);
    expect(parseLine("30g salt, pepper, chilli, lime").options[0].map((x) => x.phrase)).toEqual(["salt", "pepper", "chilli", "lime"]);
    expect(parseLine("40g cheddar, brie").options[0].map((x) => [x.phrase, x.quantity])).toEqual([["cheddar", 40], ["brie", 40]]);
  });

  it("an egg weight with a count in brackets is that many eggs", () => {
    expect(parseLine("120g eggs (5)").options).toEqual([[one("eggs", 5, "EACH")]]);
  });

  it("OR and 'choice of' give alternatives", () => {
    expect(parseLine("60g ham (Plain) OR 60g trout (Fancy)").options).toEqual([[one("ham", 60, "G")], [one("trout", 60, "G")]]);
    expect(parseLine("100g rye OR 120g toast").options).toEqual([[one("rye", 100, "G")], [one("toast", 120, "G")]]);
    expect(parseLine("Protein, choice of: 120g beef OR 130g tofu OR 170g fish").options).toEqual([
      [one("beef", 120, "G")], [one("tofu", 130, "G")], [one("fish", 170, "G")],
    ]);
  });

  it("flags optional lines", () => {
    const p = parseLine("150g chicken breast (optional)");
    expect(p.optional).toBe(true);
    expect(p.options).toEqual([[one("chicken breast", 150, "G")]]);
    expect(parseLine("2 eggs").optional).toBe(false);
  });

  it("refuses a line it cannot read", () => {
    expect(() => parseLine("a pinch of luck")).toThrow(/Cannot read/);
  });
});

describe("parseFoodBible", () => {
  const recipes = parseFoodBible(readFileSync(path.join(__dirname, "sample-bible.txt"), "utf8"));

  it("finds every dish and batch, and ignores the title", () => {
    expect(recipes.map((r) => r.name)).toEqual(["TOMATO TOAST", "HOUSE SALAD", "PLAIN LOAF"]);
    expect(recipes.filter((r) => r.batch).map((r) => r.name)).toEqual(["PLAIN LOAF"]);
  });

  it("keeps the section, the batch marker, the yield text and the lines", () => {
    const loaf = recipes.find((r) => r.name === "PLAIN LOAF")!;
    expect(loaf).toMatchObject({ section: "BAKING", batch: true, meta: ["Yield: 4 portions x 250g"] });
    expect(loaf.lines).toEqual(["500g flour", "10g salt", "120g eggs (2)"]);
    expect(recipes[0]).toMatchObject({ section: "STARTERS", batch: false });
    expect(recipes[0].lines).toHaveLength(5);
  });

  it("every ingredient line in the sample can be read", () => {
    for (const r of recipes) for (const l of r.lines) expect(() => parseLine(l), `${r.name}: ${l}`).not.toThrow();
  });
});

// The real Food Bible is kept off GitHub (the repository is public), so this only runs on the machine that has it.
const REAL = path.join(__dirname, "../../data/food-bible.txt");
describe.skipIf(!existsSync(REAL))("the real Food Bible (local file)", () => {
  // Read inside the tests: a skipped describe block is still built, and the file may not exist.
  const load = () => parseFoodBible(readFileSync(REAL, "utf8"));

  it("has 35 dishes and 17 batches", () => {
    const recipes = load();
    expect(recipes.filter((r) => r.batch)).toHaveLength(17);
    expect(recipes.filter((r) => !r.batch)).toHaveLength(35);
  });

  it("every ingredient line can be read", () => {
    for (const r of load()) for (const l of r.lines) expect(() => parseLine(l), `${r.name}: ${l}`).not.toThrow();
  });
});
