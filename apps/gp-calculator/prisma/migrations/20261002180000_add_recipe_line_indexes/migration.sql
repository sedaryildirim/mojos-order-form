-- CreateIndex
CREATE INDEX "VersionIngredient_dishVersionId_idx" ON "VersionIngredient"("dishVersionId");

-- CreateIndex
CREATE INDEX "VersionIngredient_ingredientId_idx" ON "VersionIngredient"("ingredientId");

-- CreateIndex
CREATE INDEX "BatchRecipeLine_batchRecipeId_idx" ON "BatchRecipeLine"("batchRecipeId");

-- CreateIndex
CREATE INDEX "BatchRecipeLine_ingredientId_idx" ON "BatchRecipeLine"("ingredientId");
