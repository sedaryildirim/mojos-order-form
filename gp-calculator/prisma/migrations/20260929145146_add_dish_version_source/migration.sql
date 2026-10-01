-- CreateEnum
CREATE TYPE "VersionSource" AS ENUM ('MANUAL', 'AUTO_PRICE_REFRESH');

-- AlterTable
ALTER TABLE "DishVersion" ADD COLUMN     "source" "VersionSource" NOT NULL DEFAULT 'MANUAL';
