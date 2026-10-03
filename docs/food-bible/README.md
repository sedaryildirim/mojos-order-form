# Kaif Food Bible import (done, then replaced)

> **Replaced on 2026-10-03.** All 36 imported dishes and 17 batch recipes were cleared (backup: `apps/gp-calculator/backups/pre-menu-reset-20261003T203045.sql`) and the new menu was entered by hand from the owner's recipe sheets. The GP Calculator now holds **52 dishes, 30 batch recipes and 344 ingredients** (backup: `post-menu-rebuild-*.sql`). Nothing below drives the data any more; it is kept as a record of how the first import worked. Current state: see "Current placeholders" at the end.

The recipe source is `kaif-food-bible.txt` (35 dishes and 17 batch recipes, 380 ingredient lines). **It is kept on the owner's machine only**: the
repository is public, so the recipes (and the trial cost report) are git-ignored and never pushed. 

Imported on 2026-10-02. The one-time importer (parser, phrase map and `npm run import:food-bible`) has since been removed from the code as it had done its job; it is in git history at commit `749028f` if ever needed. To move recipes to another database, restore a `pg_dump`.

## How lines were turned into costs (for reference)

- Every phrase was mapped: to a Kaif ingredient (`"Supplier|Name"`), to one of
  the bible's own batch recipes, to a mix split by share, to a **flagged estimate** (not on the Kaif list), or skipped (water).
- `40g cheddar, brie` is 40 g of **each**. Words like `scrambled`, `poached`, `skin off` are ignored.
- `A OR B` costs the **dearest** option. `(optional)` lines are left out, and `CAESAR SALAD` also gets a second dish,
  *Chicken Caesar Salad*, that includes the chicken.
- A recipe written in grams for a liquid costs it in millilitres (1 g = 1 ml). `1 bun` is one portion of the bun batch recipe.
- Where a batch gives no yield, the yield is the weight of its ingredients (an egg counts 55 g).
- Menu prices and categories come from the previous dishes by name (spelling differences like "Harrisa" are matched).

## Estimates that still need a real price

These have no price anywhere yet, so they cost 0 and their dishes show "guessed prices": Baking Powder, Baking Soda, Caesar Dressing,
Chicken Schnitzel, Coffee, Cold Milk, Croutons, Date Sauce, Emulsifier, Lady Fingers, Raisins, Starter. The other flagged estimates
(Hollandaise, Hummus, Falafel and so on) start at the guessed prices from the old data. Edit each one on the Ingredients page.

## Current placeholders (2026-10-03)

The new recipes use ingredients that are not on the Kaif order sheet. They sit under the supplier "Placeholder / Estimated" and mark every dish and batch that uses them as "guessed prices".

**Priced at 0 (real price not known yet):** Sourdough Bread (in 9 dish lines, the biggest gap), Water, Baking Powder, Baking Soda, Bay Leaves, Chickpeas, Croutons, Raisins, Soy Sauce, Balsamic Vinegar, Brandy, Burger Bun, Coffee, Cold Milk, Date Sauce, Emulsifier, Ice, Lady Fingers, Miso, Nutmeg, Pickled Lemon, Potato Starch, Starter. (Caesar Dressing and Chicken Schnitzel are also 0 but no recipe uses them now.)

**Carrying an estimate:** Bacon, Harissa, Curry Dip, Egyptian Hot Sauce, House Fries, Israeli Salad, Garlic Mayo, Burger Sauce, Caramelised Onion, Double Swiss Cheese, Pickled Cucumber, Cinnamon Powder, Cocoa Powder, Falafel, Nut Seed Mix, Sumac, Chia Seeds, Coleslaw, Fried Chicken, Gochujang Sauce, Homemade Jam, House Granola, Protein Powder, Regency, White Chocolate. **Dark Chocolate** (฿228 per kg) is an estimate worked back from the cost of the old Chocolate Chilli Ball, Bounty Bar and Chocolate Tartufo recipes, which it reproduces exactly.

Set each real price on the Ingredients page. Every dish and batch that uses it recosts and gets a new version.

## Conventions used when the new recipes were entered

- Recipes written in grams for a liquid (cream, oil, vinegar, yoghurt) are entered in millilitres, 1 g = 1 ml. Teaspoons and tablespoons are converted to grams, and "1 pc" of something priced by weight (a banana, a rosti) to an estimated weight; these estimates are written in the recipe's notes.
- A batch's yield is the total weight of its ingredients unless the owner gave one (desserts and sweets: portions x portion size). Each batch's notes say which.
- Batch recipes that an old import had already published as an ingredient were **linked** to that ingredient, so no second ingredient with the same name was created.
- Dishes that are one portion of a batch (cakes, sweets, desserts) are described in `apps/gp-calculator/README.md`.

## Related

- The weekly order-sheet sync that keeps ingredient prices current: root `README.md`, "Weekly price update".
- Dish and batch pages show a GP history chart of the last 6 updates, so you can see how a dish's GP moves as those prices change.
