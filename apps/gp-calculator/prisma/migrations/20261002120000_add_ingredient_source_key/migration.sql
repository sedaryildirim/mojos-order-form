-- AlterTable
ALTER TABLE "Ingredient" ADD COLUMN "sourceKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Ingredient_sourceKey_key" ON "Ingredient"("sourceKey");
