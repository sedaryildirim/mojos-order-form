// Pulls the Kaif order sheet into the GP Calculator. Dry run by default: nothing is written until --apply.
// Run: npm run sync:order-sheet [-- --apply] [-- --file ../web/config/data.js]
import { prisma } from "../src/lib/db/prisma";
import { syncOrderSheet } from "../src/lib/sync/order-sheet";
import { buildRows, loadOrderSheetText, parseOrderSheet } from "../src/lib/sync/order-sheet-rows";

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const fileIdx = args.indexOf("--file");
  const text = await loadOrderSheetText({ file: fileIdx >= 0 ? args[fileIdx + 1] : undefined, url: process.env.ORDER_SHEET_URL });
  const rows = buildRows(parseOrderSheet(text));
  const r = await syncOrderSheet(rows, { apply, actor: "Order sheet sync" });

  console.log(apply ? "APPLIED" : "DRY RUN: nothing was written (add --apply to write)");
  console.log(
    `${rows.length} sheet items | new ${r.created.length} | price changed ${r.priceChanged.length} | unchanged ${r.unchanged} | ` +
      `removed ${r.removed.length} | archived (still used) ${r.archivedBecauseUsed.length} | need a pack size ${r.needsPackSize.length} | pack differs ${r.packMismatch.length}`
  );
  for (const p of r.priceChanged) console.log(`  price   ${p.name} (${p.supplier}): ${p.oldPrice} -> ${p.newPrice}`);
  for (const x of r.needsPackSize) console.log(`  PACK?   ${x.name} (${x.supplier}) is new and its pack size is not in the name`);
  for (const x of r.packMismatch) console.log(`  UNIT?   ${x.name} (${x.supplier}): GP has ${x.gpPack}, sheet has ${x.sheetPack} at ${x.sheetPrice} (left as it is)`);
  for (const x of r.archivedBecauseUsed) console.log(`  ARCHIVED (still used) ${x.name} (${x.supplier})`);
  console.log(`  dishes ${apply ? "recalculated" : "that would change"}: ${r.dishes.length}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
