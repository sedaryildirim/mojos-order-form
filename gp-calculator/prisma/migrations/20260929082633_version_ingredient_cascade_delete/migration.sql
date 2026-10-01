-- DropForeignKey
ALTER TABLE "VersionIngredient" DROP CONSTRAINT "VersionIngredient_dishVersionId_fkey";

-- AddForeignKey
ALTER TABLE "VersionIngredient" ADD CONSTRAINT "VersionIngredient_dishVersionId_fkey" FOREIGN KEY ("dishVersionId") REFERENCES "DishVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
