// One-time cleanup: removes ingredients that are not on the Kaif order sheet and that nothing uses. Dry run by default.
// Run: npm run prune:ingredients [-- --apply]
import { prisma } from "../src/lib/db/prisma";
import { pruneUnmanagedIngredients } from "../src/lib/sync/prune";

async function main() {
  const apply = process.argv.includes("--apply");
  const r = await pruneUnmanagedIngredients({ apply, actor: "Order sheet sync" });
  console.log(apply ? "APPLIED" : "DRY RUN (add --apply to write)");
  console.log(`delete ${r.deleted.length} | archive ${r.archived.length} | keep (still used) ${r.kept.length}`);
  for (const x of r.deleted) console.log(`  delete   ${x.name} (${x.supplier})`);
  for (const x of r.archived) console.log(`  archive  ${x.name} (${x.supplier})`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
