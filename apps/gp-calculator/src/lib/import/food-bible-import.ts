import { prisma } from "@/lib/db/prisma";
import { syncBatchOutput } from "@/lib/costing/batch";
import { lineCost } from "@/lib/costing/costing";
import { BibleRecipe, LineItem, LineUnit, parseLine } from "./food-bible-parse";

type Purchase = "G" | "ML" | "EACH";
type Piece = { quantity: number; unit: Purchase };

// How each phrase used in the bible is costed.
export type MapEntry =
  | { ingredient: string } // "Supplier|Ingredient name" on the Kaif list
  | { batch: string; perPiece?: Piece } // one of the bible's own batch recipes (perPiece: what "1 bun" weighs)
  | { mix: { ingredient: string; share: number }[] } // several ingredients sharing one weight
  | { placeholder: { name: string } } // not on the Kaif list: a flagged estimate
  | { skip: true; why?: string };
export type BibleMap = Record<string, MapEntry>;

// What the previous dishes looked like (from a backup), used to keep menu prices, categories, photos and old estimates.
export interface OldData {
  dishes: { name: string; category: string; sellingPrice: number | null; photoUrl: string | null }[];
  batches: { name: string; category: string }[];
  ingredients: { name: string; purchaseUnit: string; packQuantity: number; packPrice: number }[];
}

export interface ImportOptions {
  apply: boolean;
  actor: string;
  map: BibleMap;
  old: OldData;
  // A dish whose optional lines are left out of the base dish also gets a second dish that includes them.
  optionalVariants?: Record<string, string>;
}

export interface ImportReport {
  applied: boolean;
  batches: { name: string; yieldQuantity: number; portionSize: number | null; cost: number; lines: number }[];
  dishes: { name: string; cost: number; sellingPrice: number | null; lines: number }[];
  placeholders: string[];
  // Each flagged estimate with the price it starts at (0 = no price known yet).
  estimates: { name: string; purchaseUnit: string; packQuantity: number; packPrice: number; fromOldData: boolean }[];
  skipped: { recipe: string; line: string; why: string }[];
  choices: { dish: string; line: string; chose: string; cost: number; others: string[] }[];
}

const ESTIMATE_SUPPLIER = "Placeholder / Estimated";
const EGG_GRAMS = 55; // only used to estimate a batch's weight when its yield is not stated

interface VIng {
  key: string;
  id?: string;
  name: string;
  purchaseUnit: Purchase;
  packQuantity: number;
  packPrice: number;
}
interface PlannedLine {
  ing: VIng;
  quantity: number;
  unit: LineUnit;
  cost: number;
}

const norm = (s: string) => s.toLowerCase().replace(/\([^)]*\)/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
const titleCase = (s: string) =>
  s.toLowerCase().split(" ").map((w) => (w === "kfc" ? "KFC" : w.length > 0 && /[a-z]/.test(w[0]) ? w[0].toUpperCase() + w.slice(1) : w)).join(" ");

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}
// An old dish or batch with the same name, or one spelled slightly differently ("Harrisa" / "Harissa", "Home Made" / "Homemade").
function findOld<T extends { name: string }>(list: T[], name: string): { item: T; exact: boolean } | null {
  const lower = list.find((x) => x.name.toLowerCase() === name.toLowerCase());
  if (lower) return { item: lower, exact: true };
  const key = squash(name);
  const same = list.find((x) => squash(x.name) === key);
  if (same) return { item: same, exact: false };
  const near = list.find((x) => Math.max(squash(x.name).length, key.length) >= 9 && distance(squash(x.name), key) <= 2);
  return near ? { item: near, exact: false } : null;
}

const family = (u: string) => (u === "EACH" ? "count" : u === "ML" || u === "L" ? "volume" : "weight");

// The recipe's unit has to be in the same family as the ingredient is sold in. The GP sells liquids by volume, but a
// recipe written in grams means millilitres there (1 g = 1 ml), as the kitchen does.
function adaptUnit(ing: VIng, quantity: number, unit: LineUnit): { quantity: number; unit: LineUnit } {
  const want = family(ing.purchaseUnit);
  const have = family(unit);
  if (want === have) return { quantity, unit };
  if (want === "volume" && have === "weight") return { quantity, unit: unit === "KG" ? "L" : "ML" };
  if (want === "weight" && have === "volume") return { quantity, unit: unit === "L" ? "KG" : "G" };
  throw new Error(`"${ing.name}" is sold per piece, but a recipe gives it as ${quantity} ${unit}`);
}

const grams = (q: number, u: LineUnit) => (u === "KG" || u === "L" ? q * 1000 : u === "EACH" ? q * EGG_GRAMS : q);

function parseMeta(meta: string[], totalWeight: number): { yieldQuantity: number; portionSize: number | null; estimated: boolean } {
  const text = meta.join(" ");
  let m = /(\d+(?:\.\d+)?)\s*portions?\s*x\s*(\d+(?:\.\d+)?)\s*g/i.exec(text);
  if (m) return { yieldQuantity: Number(m[1]) * Number(m[2]), portionSize: Number(m[2]), estimated: false };
  m = /Portion:\s*(?:1 ball =\s*)?(\d+(?:\.\d+)?)\s*g/i.exec(text) ?? /rolled into (\d+(?:\.\d+)?)\s*g/i.exec(text) ?? /(\d+(?:\.\d+)?)\s*g portions/i.exec(text);
  if (m) return { yieldQuantity: totalWeight, portionSize: Number(m[1]), estimated: true };
  m = /Yield:\s*(\d+)\s*portions\s*$/i.exec(text);
  if (m) return { yieldQuantity: totalWeight, portionSize: Math.round((totalWeight / Number(m[1])) * 100) / 100, estimated: true };
  return { yieldQuantity: totalWeight, portionSize: null, estimated: true };
}

export async function importFoodBible(recipes: BibleRecipe[], opts: ImportOptions): Promise<ImportReport> {
  const { apply, actor, map, old, optionalVariants = {} } = opts;
  if ((await prisma.dish.count()) + (await prisma.batchRecipe.count()) > 0) {
    throw new Error("The database already has dishes or batch recipes. This import is for an empty start. Nothing was changed.");
  }

  // ---- 1. every phrase must be mapped, and every ingredient the map names must exist
  const parsed = recipes.map((r) => ({ recipe: r, lines: r.lines.map((l) => parseLine(l)) }));
  const unmapped = new Set<string>();
  const wanted = new Set<string>();
  const batchNames = new Set(recipes.filter((r) => r.batch).map((r) => r.name));
  const missingBatch = new Set<string>();
  for (const p of parsed) {
    for (const l of p.lines) {
      for (const opt of l.options) {
        for (const it of opt) {
          const e = map[it.phrase];
          if (!e) unmapped.add(it.phrase);
          else if ("ingredient" in e) wanted.add(e.ingredient);
          else if ("mix" in e) e.mix.forEach((x) => wanted.add(x.ingredient));
          else if ("batch" in e && !batchNames.has(e.batch)) missingBatch.add(e.batch);
        }
      }
    }
  }
  if (unmapped.size) throw new Error(`No mapping for: ${Array.from(unmapped).join(", ")}. Nothing was changed.`);
  if (missingBatch.size) throw new Error(`The map points at batch recipes that are not in the bible: ${Array.from(missingBatch).join(", ")}.`);

  const dbIngredients = await prisma.ingredient.findMany({ where: { archived: false }, include: { supplier: { select: { name: true } } } });
  const byKey = new Map<string, VIng>();
  for (const i of dbIngredients) {
    byKey.set(`${i.supplier.name}|${i.name}`, { key: `${i.supplier.name}|${i.name}`, id: i.id, name: i.name, purchaseUnit: i.purchaseUnit, packQuantity: Number(i.packQuantity), packPrice: Number(i.packPrice) });
  }
  const missing = Array.from(wanted).filter((k) => !byKey.has(k));
  if (missing.length) throw new Error(`These ingredients are not on the Kaif list: ${missing.join("; ")}. Nothing was changed.`);

  // ---- 2. flagged estimates for everything with no Kaif ingredient
  const placeholders = new Map<string, VIng>();
  for (const e of Object.values(map)) {
    if (!("placeholder" in e) || placeholders.has(e.placeholder.name)) continue;
    const n = norm(e.placeholder.name);
    const found = old.ingredients.find((o) => norm(o.name) === n) ?? old.ingredients.find((o) => norm(o.name).startsWith(n + " "));
    // A price under 1 baht a pack is a leftover placeholder value, not a real price.
    const hit = found && found.packPrice >= 1 ? found : undefined;
    placeholders.set(e.placeholder.name, {
      key: `placeholder:${e.placeholder.name}`, name: e.placeholder.name,
      purchaseUnit: (hit?.purchaseUnit as Purchase) ?? "G", packQuantity: hit?.packQuantity ?? 1000, packPrice: hit?.packPrice ?? 0,
    });
  }
  const usedPlaceholders = new Set<string>();

  const report: ImportReport = { applied: apply, batches: [], dishes: [], placeholders: [], estimates: [], skipped: [], choices: [] };
  const batchOutputs = new Map<string, VIng>(); // bible batch name -> its published ingredient

  // ---- 3. plan one item of a line into costed recipe lines
  function planItem(recipeName: string, item: LineItem, rawLine: string): PlannedLine[] {
    const e = map[item.phrase];
    const out: PlannedLine[] = [];
    const add = (ing: VIng, quantity: number, unit: LineUnit) => {
      const a = adaptUnit(ing, quantity, unit);
      const cost = lineCost({ purchaseUnit: ing.purchaseUnit, packQuantity: ing.packQuantity, packPrice: ing.packPrice, yieldPct: 100 }, a.quantity, a.unit);
      out.push({ ing, quantity: a.quantity, unit: a.unit, cost });
    };
    if ("skip" in e) {
      report.skipped.push({ recipe: recipeName, line: rawLine, why: e.why ?? "skipped" });
    } else if ("ingredient" in e) {
      add(byKey.get(e.ingredient)!, item.quantity, item.unit);
    } else if ("mix" in e) {
      for (const part of e.mix) add(byKey.get(part.ingredient)!, item.quantity * part.share, item.unit);
    } else if ("placeholder" in e) {
      usedPlaceholders.add(e.placeholder.name);
      add(placeholders.get(e.placeholder.name)!, item.quantity, item.unit);
    } else {
      const batch = batchOutputs.get(e.batch);
      if (!batch) throw new Error(`"${item.phrase}" in ${recipeName} uses the batch ${e.batch}, which has not been defined before it`);
      if (e.perPiece && item.unit === "EACH") add(batch, item.quantity * e.perPiece.quantity, e.perPiece.unit);
      else add(batch, item.quantity, item.unit);
    }
    return out;
  }

  // The dearest alternative on an OR line; optional lines only when asked for.
  function planRecipeLines(r: BibleRecipe, lines: typeof parsed[number]["lines"], includeOptional: boolean): PlannedLine[] {
    const result: PlannedLine[] = [];
    for (const l of lines) {
      if (l.optional && !includeOptional) continue;
      const planned = l.options.map((opt) => opt.flatMap((it) => planItem(r.name, it, l.raw)));
      if (planned.length === 1) {
        result.push(...planned[0]);
        continue;
      }
      const costs = planned.map((p) => p.reduce((s, x) => s + x.cost, 0));
      const best = costs.indexOf(Math.max(...costs));
      result.push(...planned[best]);
      report.choices.push({
        dish: r.name, line: l.raw, chose: l.options[best].map((x) => x.phrase).join(", "), cost: costs[best],
        others: l.options.filter((_, i) => i !== best).map((o) => o.map((x) => x.phrase).join(", ")),
      });
    }
    return result;
  }

  // ---- 4. plan batches (in document order), publishing each as a virtual ingredient
  const plannedBatches: { name: string; category: string; yieldQuantity: number; portionSize: number | null; notes: string; lines: PlannedLine[]; cost: number; key: string }[] = [];
  for (const p of parsed.filter((x) => x.recipe.batch)) {
    const lines = planRecipeLines(p.recipe, p.lines, false);
    const cost = lines.reduce((s, l) => s + l.cost, 0);
    const weight = lines.reduce((s, l) => s + grams(l.quantity, l.unit), 0);
    const meta = parseMeta(p.recipe.meta, Math.round(weight));
    const oldBatch = findOld(old.batches, p.recipe.name);
    const display = oldBatch?.exact ? oldBatch.item.name : titleCase(p.recipe.name);
    const category = oldBatch?.item.category ?? titleCase(p.recipe.section);
    const notes = `From the Kaif Food Bible. ${p.recipe.meta.join(" ")}${meta.estimated ? " Yield set to the weight of the ingredients where the bible gives none." : ""}`.trim();
    const key = `batch:${p.recipe.name}`;
    batchOutputs.set(p.recipe.name, { key, name: display, purchaseUnit: "G", packQuantity: meta.yieldQuantity, packPrice: cost });
    plannedBatches.push({ name: display, category, yieldQuantity: meta.yieldQuantity, portionSize: meta.portionSize, notes, lines, cost, key });
    report.batches.push({ name: display, yieldQuantity: meta.yieldQuantity, portionSize: meta.portionSize, cost, lines: lines.length });
  }

  // ---- 5. plan dishes
  const plannedDishes: { name: string; category: string; sellingPrice: number | null; photoUrl: string | null; lines: PlannedLine[]; cost: number }[] = [];
  for (const p of parsed.filter((x) => !x.recipe.batch)) {
    const found = findOld(old.dishes, p.recipe.name);
    const oldDish = found?.item;
    const make = (name: string, lines: PlannedLine[], inherit: boolean) => {
      const cost = lines.reduce((s, l) => s + l.cost, 0);
      plannedDishes.push({ name, category: oldDish?.category ?? titleCase(p.recipe.section), sellingPrice: inherit ? oldDish?.sellingPrice ?? null : null, photoUrl: inherit ? oldDish?.photoUrl ?? null : null, lines, cost });
      report.dishes.push({ name, cost, sellingPrice: inherit ? oldDish?.sellingPrice ?? null : null, lines: lines.length });
    };
    make(found?.exact ? oldDish!.name : titleCase(p.recipe.name), planRecipeLines(p.recipe, p.lines, false), true);
    const variant = optionalVariants[p.recipe.name];
    if (variant) make(variant, planRecipeLines(p.recipe, p.lines, true), false);
  }
  report.placeholders = Array.from(usedPlaceholders).sort();
  report.estimates = report.placeholders.map((name) => {
    const v = placeholders.get(name)!;
    return { name, purchaseUnit: v.purchaseUnit, packQuantity: v.packQuantity, packPrice: v.packPrice, fromOldData: v.packPrice > 0 };
  });

  if (!apply) return report;

  // ---- 6. write: estimates, then batches (which publish their ingredient), then dishes
  const supplier =
    (await prisma.supplier.findFirst({ where: { name: ESTIMATE_SUPPLIER } })) ??
    (await prisma.supplier.create({ data: { name: ESTIMATE_SUPPLIER, createdBy: actor, updatedBy: actor } }));
  for (const name of Array.from(usedPlaceholders)) {
    const v = placeholders.get(name)!;
    const created = await prisma.ingredient.create({
      data: { name, category: "Estimated", supplierId: supplier.id, purchaseUnit: v.purchaseUnit, packQuantity: v.packQuantity, packPrice: v.packPrice, priceEstimated: true, createdBy: actor, updatedBy: actor },
    });
    v.id = created.id;
  }
  for (const b of plannedBatches) {
    const created = await prisma.batchRecipe.create({
      data: {
        name: b.name, category: b.category, yieldQuantity: b.yieldQuantity, yieldUnit: "G", portionSize: b.portionSize, notes: b.notes, createdBy: actor, updatedBy: actor,
        lines: { create: b.lines.map((l) => ({ ingredientId: l.ing.id!, quantity: l.quantity, unit: l.unit })) },
      },
    });
    await syncBatchOutput(created.id, actor);
    const out = (await prisma.batchRecipe.findUniqueOrThrow({ where: { id: created.id } })).outputIngredientId;
    if (!out) throw new Error(`The batch ${b.name} has no priced ingredients, so it cannot be published`);
    const v = Array.from(batchOutputs.values()).find((x) => x.key === b.key)!;
    v.id = out;
  }
  for (const d of plannedDishes) {
    const dish = await prisma.dish.create({ data: { name: d.name, category: d.category, createdBy: actor } });
    await prisma.dishVersion.create({
      data: {
        dishId: dish.id, versionNumber: 1, costSnapshot: d.cost, sellingPrice: d.sellingPrice, photoUrl: d.photoUrl, createdBy: actor,
        notes: "Imported from the Kaif Food Bible.",
        lines: { create: d.lines.map((l) => ({ ingredientId: l.ing.id!, ingredientNameSnapshot: l.ing.name, quantity: l.quantity, unit: l.unit, lineCostSnapshot: l.cost })) },
      },
    });
  }
  return report;
}
