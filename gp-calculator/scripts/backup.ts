// Writes every table to backups/backup-<timestamp>.json so the data survives a lost database.
// Run with: npm run backup
import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { prisma } from "../src/lib/prisma";

async function main() {
  const data = {
    createdAt: new Date().toISOString(),
    suppliers: await prisma.supplier.findMany(),
    ingredients: await prisma.ingredient.findMany(),
    dishes: await prisma.dish.findMany(),
    dishVersions: await prisma.dishVersion.findMany(),
    versionIngredients: await prisma.versionIngredient.findMany(),
    batchRecipes: await prisma.batchRecipe.findMany(),
    batchRecipeLines: await prisma.batchRecipeLine.findMany(),
  };
  const dir = path.join(process.cwd(), "backups");
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `backup-${data.createdAt.replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, JSON.stringify(data, null, 1));
  console.log(`Backed up ${data.ingredients.length} ingredients, ${data.dishes.length} dishes, ${data.batchRecipes.length} batch recipes to ${file}`);
  await prisma.$disconnect();
}
main();
