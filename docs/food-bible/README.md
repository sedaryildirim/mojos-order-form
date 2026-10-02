# Kaif Food Bible import

The recipe source is `kaif-food-bible.txt` (35 dishes and 17 batch recipes, 380 ingredient lines). **It is kept on the owner's machine only**: the
repository is public, so the recipes (and the trial cost report) are git-ignored and never pushed. A copy at
`apps/gp-calculator/src/data/food-bible.txt` is the one the importer reads. The tests use the invented `src/lib/import/sample-bible.txt` instead.

Imported on 2026-10-02 with `npm run import:food-bible -- --backup <backup.json> --apply` (dry run without `--apply`).
It only runs on an empty start: it refuses if the database already has dishes or batch recipes.

## How lines are turned into costs

- Every phrase is mapped in `apps/gp-calculator/src/data/food-bible-map.json`: to a Kaif ingredient (`"Supplier|Name"`), to one of
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

## Related

- The weekly order-sheet sync that keeps ingredient prices current: root `README.md`, "Weekly price update".
- Dish and batch pages show a GP history chart of the last 6 updates, so you can see how a dish's GP moves as those prices change.
