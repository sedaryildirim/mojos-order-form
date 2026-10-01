-- AlterTable
ALTER TABLE "Ingredient" ADD COLUMN     "priceEstimated" BOOLEAN NOT NULL DEFAULT false;

-- Everything currently under the placeholder supplier is an estimate until it is confirmed.
UPDATE "Ingredient" SET "priceEstimated" = true
WHERE "supplierId" IN (SELECT "id" FROM "Supplier" WHERE "name" LIKE 'Placeholder%');
