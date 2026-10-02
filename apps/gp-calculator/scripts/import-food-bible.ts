// Imports the Kaif Food Bible (src/data/food-bible.txt) as batch recipes and dishes. Dry run by default.
// Menu prices, categories, photos and old estimated prices come from a backup of the previous data, matched by name.
// Run: npm run import:food-bible -- --backup backups/backup-<time>.json [--apply]
import { readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/db/prisma";
import { BibleMap, importFoodBible, OldData } from "../src/lib/import/food-bible-import";
import { parseFoodBible } from "../src/lib/import/food-bible-parse";

const VARIANTS = { "CAESAR SALAD": "Chicken Caesar Salad" };

function loadOld(file: string): OldData {
  const b = JSON.parse(readFileSync(file, "utf8"));
  const latest = new Map<string, { n: number; sellingPrice: number | null; photoUrl: string | null }>();
  for (const v of b.dishVersions) {
    const cur = latest.get(v.dishId);
    if (!cur || v.versionNumber > cur.n) latest.set(v.dishId, { n: v.versionNumber, sellingPrice: v.sellingPrice === null ? null : Number(v.sellingPrice), photoUrl: v.photoUrl ?? null });
  }
  return {
    dishes: b.dishes.map((d: { id: string; name: string; category: string }) => ({ name: d.name, category: d.category, sellingPrice: latest.get(d.id)?.sellingPrice ?? null, photoUrl: latest.get(d.id)?.photoUrl ?? null })),
    batches: b.batchRecipes.map((r: { name: string; category: string }) => ({ name: r.name, category: r.category })),
    ingredients: b.ingredients.map((i: { name: string; purchaseUnit: string; packQuantity: string; packPrice: string }) => ({ name: i.name, purchaseUnit: i.purchaseUnit, packQuantity: Number(i.packQuantity), packPrice: Number(i.packPrice) })),
  };
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const i = args.indexOf("--backup");
  if (i < 0 || !args[i + 1]) throw new Error("Pass the backup to read old prices and photos from: --backup backups/backup-<time>.json");
  const root = path.join(__dirname, "..");
  const recipes = parseFoodBible(readFileSync(path.join(root, "src/data/food-bible.txt"), "utf8"));
  const map = JSON.parse(readFileSync(path.join(root, "src/data/food-bible-map.json"), "utf8")) as BibleMap;
  const r = await importFoodBible(recipes, { apply, actor: "Food Bible import", map, old: loadOld(args[i + 1]), optionalVariants: VARIANTS });

  console.log(apply ? "APPLIED" : "DRY RUN: nothing was written (add --apply to write)");
  console.log(`${r.batches.length} batches | ${r.dishes.length} dishes | ${r.placeholders.length} flagged estimates | ${r.choices.length} choices | ${r.skipped.length} lines skipped`);
  console.log("\nBATCHES");
  for (const b of r.batches) console.log(`  ${b.name.padEnd(24)} yield ${String(b.yieldQuantity).padStart(5)} g | portion ${String(b.portionSize ?? "-").padStart(6)} | cost ${b.cost.toFixed(2).padStart(8)} | ${b.lines} lines`);
  console.log("\nDISHES");
  for (const d of r.dishes) {
    const gp = d.sellingPrice ? ` | GP ${(((d.sellingPrice / 1.07 - d.cost) / (d.sellingPrice / 1.07)) * 100).toFixed(0)}%` : "";
    console.log(`  ${d.name.padEnd(26)} cost ${d.cost.toFixed(2).padStart(7)} | price ${d.sellingPrice === null ? "  none" : String(d.sellingPrice).padStart(6)}${gp}`);
  }
  console.log("\nCHOICES (the dearest option was costed)");
  for (const c of r.choices) console.log(`  ${c.dish}: ${c.chose} (${c.cost.toFixed(2)}) over ${c.others.join(" / ")}`);
  console.log("\nSKIPPED");
  for (const s of r.skipped) console.log(`  ${s.recipe}: ${s.line} (${s.why})`);
  console.log("\nFLAGGED ESTIMATES (price from your old data, or NEEDS A PRICE)");
  for (const e of r.estimates) console.log(`  ${e.name.padEnd(26)} ${e.packPrice > 0 ? `${e.packPrice} per ${e.packQuantity} ${e.purchaseUnit}` : "NEEDS A PRICE"}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
