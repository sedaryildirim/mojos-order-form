// Points recipes that use one ingredient at another (the app's "switch ingredient"): same quantities and units,
// dishes get a new "Updated" version, batch lines are edited in place. Dry run by default.
// The mapping file is a JSON list: [{ "fromId": "<ingredient id>", "toSourceKey": "makro-kaif:12345" }, ...]
// Run: npm run map:ingredients -- <mapping.json> [--apply]
import { readFileSync } from "node:fs";
import { prisma } from "../src/lib/db/prisma";
import { switchIngredient } from "../src/lib/costing/switch";

interface Mapping {
  fromId: string;
  toSourceKey: string;
}

async function main() {
  const [file, ...flags] = process.argv.slice(2);
  if (!file) throw new Error("Usage: npm run map:ingredients -- <mapping.json> [--apply]");
  const apply = flags.includes("--apply");
  const mappings: Mapping[] = JSON.parse(readFileSync(file, "utf8"));
  console.log(apply ? "APPLYING" : "DRY RUN (add --apply to write)", `${mappings.length} mappings`);
  for (const m of mappings) {
    const [from, to] = await Promise.all([
      prisma.ingredient.findUnique({ where: { id: m.fromId } }),
      prisma.ingredient.findUnique({ where: { sourceKey: m.toSourceKey } }),
    ]);
    if (!from || !to) {
      console.log(`  SKIP  ${m.fromId} -> ${m.toSourceKey}: ${!from ? "source ingredient not found" : "target not found (run the sync first)"}`);
      continue;
    }
    if (!apply) {
      console.log(`  would point "${from.name}" at "${to.name}"`);
      continue;
    }
    const r = await switchIngredient(from.id, to.id, "Order sheet sync");
    console.log(`  "${from.name}" -> "${to.name}": ${r.dishesSwitched} dishes, ${r.batchesSwitched} batch lines`);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
