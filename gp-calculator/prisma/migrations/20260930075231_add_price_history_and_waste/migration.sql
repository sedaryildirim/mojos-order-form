-- CreateTable
CREATE TABLE "IngredientPriceHistory" (
    "id" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "supplierName" TEXT NOT NULL,
    "purchaseUnit" "PurchaseUnit" NOT NULL,
    "packQuantity" DECIMAL(10,2) NOT NULL,
    "packPrice" DECIMAL(10,2) NOT NULL,
    "yieldPct" DECIMAL(5,2) NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedBy" TEXT NOT NULL,

    CONSTRAINT "IngredientPriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WasteEntry" (
    "id" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unit" "RecipeUnit" NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "costSnapshot" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "WasteEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IngredientPriceHistory_ingredientId_recordedAt_idx" ON "IngredientPriceHistory"("ingredientId", "recordedAt");

-- CreateIndex
CREATE INDEX "WasteEntry_createdAt_idx" ON "WasteEntry"("createdAt");

-- AddForeignKey
ALTER TABLE "IngredientPriceHistory" ADD CONSTRAINT "IngredientPriceHistory_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WasteEntry" ADD CONSTRAINT "WasteEntry_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Baseline: every existing ingredient starts with one history row holding its current price.
INSERT INTO "IngredientPriceHistory" ("id", "ingredientId", "supplierName", "purchaseUnit", "packQuantity", "packPrice", "yieldPct", "recordedAt", "recordedBy")
SELECT gen_random_uuid()::text, i."id", s."name", i."purchaseUnit", i."packQuantity", i."packPrice", i."yieldPct", i."updatedAt", 'baseline'
FROM "Ingredient" i JOIN "Supplier" s ON s."id" = i."supplierId";
