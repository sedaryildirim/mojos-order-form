-- CreateEnum
CREATE TYPE "RecipeUnit" AS ENUM ('G', 'KG', 'ML', 'L', 'EACH');

-- CreateEnum
CREATE TYPE "VersionStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "Dish" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "Dish_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DishVersion" (
    "id" TEXT NOT NULL,
    "dishId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "notes" TEXT,
    "sellingPrice" DECIMAL(10,2),
    "targetGpPct" DECIMAL(5,2),
    "costSnapshot" DECIMAL(10,2) NOT NULL,
    "photoUrl" TEXT,
    "status" "VersionStatus" NOT NULL DEFAULT 'DRAFT',
    "shareToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "DishVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VersionIngredient" (
    "id" TEXT NOT NULL,
    "dishVersionId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "ingredientNameSnapshot" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unit" "RecipeUnit" NOT NULL,
    "lineCostSnapshot" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "VersionIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DishVersion_shareToken_key" ON "DishVersion"("shareToken");

-- CreateIndex
CREATE UNIQUE INDEX "DishVersion_dishId_versionNumber_key" ON "DishVersion"("dishId", "versionNumber");

-- AddForeignKey
ALTER TABLE "DishVersion" ADD CONSTRAINT "DishVersion_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "Dish"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VersionIngredient" ADD CONSTRAINT "VersionIngredient_dishVersionId_fkey" FOREIGN KEY ("dishVersionId") REFERENCES "DishVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VersionIngredient" ADD CONSTRAINT "VersionIngredient_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
