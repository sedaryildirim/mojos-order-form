-- CreateTable
CREATE TABLE "BatchRecipe" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "yieldQuantity" DECIMAL(10,2) NOT NULL,
    "yieldUnit" "PurchaseUnit" NOT NULL,
    "notes" TEXT,
    "outputIngredientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT NOT NULL,

    CONSTRAINT "BatchRecipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BatchRecipeLine" (
    "id" TEXT NOT NULL,
    "batchRecipeId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unit" "RecipeUnit" NOT NULL,

    CONSTRAINT "BatchRecipeLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BatchRecipe_outputIngredientId_key" ON "BatchRecipe"("outputIngredientId");

-- AddForeignKey
ALTER TABLE "BatchRecipe" ADD CONSTRAINT "BatchRecipe_outputIngredientId_fkey" FOREIGN KEY ("outputIngredientId") REFERENCES "Ingredient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchRecipeLine" ADD CONSTRAINT "BatchRecipeLine_batchRecipeId_fkey" FOREIGN KEY ("batchRecipeId") REFERENCES "BatchRecipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchRecipeLine" ADD CONSTRAINT "BatchRecipeLine_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
