# Kaif order sheet -> GP Calculator sync: design

## Goal
The GP Calculator's ingredient list is the Kaif order sheet's list. When the order sheet is updated each week, one action pulls the new prices in, and every dish and batch recipe that uses a changed ingredient gets a new "Updated" version with cost and GP recalculated.

## Decisions (from the owner)
- Recipes are **kept**: dishes, their versions and the batch recipes are not wiped. Their lines are re-linked to the fresh ingredients by name.
- Unused ingredients are **deleted**, not archived.
- Items not on the Kaif order sheet are removed: the current list mixes Mojo's and Kaif items, and only Kaif's belong.
- The sync starts from a **command and a button** on the Ingredients page. No schedule yet.
- Items that later disappear from the order sheet are removed from the GP.

## Rulings (where the owner's words met a hard limit)
1. **"Remove" cannot mean delete when a recipe still uses the item.** The database refuses to delete an ingredient that a dish or batch line points at, and doing so would break the recipe. Such items are kept and **archived**, and are listed in the report so the owner can swap them for a Kaif item. Everything not used is deleted. Cost if wrong: a few archived items stay until swapped.
2. **Batch output ingredients are never deleted or synced.** They belong to their batch recipe (supplier "House-Made"), not to the order sheet.

## Scope
Order-sheet suppliers synced (from `apps/web/config/config.js`, Kaif Chaloklum): `makro-kaif` -> Makro, `winepro` -> Wine Pro, `phangangreenveg` -> Phangan Green Vegetables, `labottega` -> La Bottega, `fruitshop` -> Boy Fruit Shop. Out of scope: Mojo's lists (`makro-samui`, `makro-phangan`, `foodproject`, `drinks`), any change to the order form, the app's screens beyond one button, scheduling.

## Data model
Add `Ingredient.sourceKey String? @unique` (additive migration; existing rows stay null). Format `"<sheetSupplierId>:<itemId>"`, for example `makro-kaif:135318`. Matching by this key means a renamed item updates in place and never duplicates.

## How a sync works
`src/lib/sync/order-sheet.ts`, one function used by the command, the API and the button:
1. **Load** the sheet: from the published site (`https://sedaryildirim.github.io/mojos-order-form/config/data.js`) or a local file (`--file`). The file is `const DATA = {...};` and is parsed as JSON, never executed.
2. **Turn each item into an ingredient row**: name, sheet category, GP supplier (mapping above), purchase unit and pack size, pack price. A `Kilogram` item is 1000 G at the per-kg price. An `EACH` item's pack size is read from the name ("5 kg" = 5000 G, "1 l x 3" = 3000 ML, "30 pcs" = 30 EACH). Anything unreadable comes from the override file `src/data/order-sheet-packs.json`, and if it is in neither, it is imported as 1 EACH, flagged as needing a pack size, and listed in the report. On the Kaif sheet 222 of 246 items read cleanly.
3. **Match** an existing ingredient by `sourceKey`, else by exact name and supplier (which also fills in `sourceKey`, so existing recipe links are kept as they are).
4. **Apply** with the existing import code: new rows are created, changed prices are updated with price history, and the dishes and batches that use a changed ingredient are recalculated into new versions.
5. **Remove** ingredients that carry a `sourceKey` no longer on the sheet: delete if unused, archive if a recipe uses it (ruling 1).
6. **Report**: created, price changed (old -> new), unchanged, removed, archived-because-used, needs a pack size.

Dry run is the default everywhere (preview, then apply), matching the app's other import commands.

## Interfaces
- Command: `npm run sync:order-sheet [-- --apply] [-- --file <path>]`.
- API: `POST /api/sync/order-sheet` with `{ apply: boolean }`, returns the report.
- Ingredients page: a "Sync from order sheet" button that shows the preview report, then an Apply step. Signed-in only, like every other route.

## One-time cleanup (after the sync is built and tested)
1. **Restore point**: `pg_dump` of `gp_calculator` plus `npm run backup`. If anything goes wrong, restoring puts it all back.
2. **Trial first**: copy the database (`createdb -T`), run the sync and the cleanup on the copy, and check dishes, batches and costs.
3. **Names that do not match.** A used ingredient whose name differs from its sheet item (for example "MEIJI Pasteurized Milk" and "MEIJI Pasteurized Milk Plain 2 l") would otherwise become a duplicate. I produce a proposed mapping list from the trial, the owner approves or edits it, and the existing "switch ingredient" function then moves the recipes (new dish versions, history kept).
4. **Real run**: sync apply, apply the approved mappings, then delete unused ingredients that are not on the Kaif sheet. Report what was deleted, archived and flagged.

## Verification
Tests first for the pack parser, the row builder, matching and removal rules (including "used ingredient is archived, not deleted" and "batch outputs untouched"). Then the trial on the copy, with dish costs before and after listed for every dish. Then the real run, with before and after counts, and a restore check that the dump loads.

## Not covered
Auto-scheduling (a later step: a cron calling the same API), Mojo's pricing in the GP, and any change to the order form.
