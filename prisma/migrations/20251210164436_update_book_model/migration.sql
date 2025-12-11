/*
  Warnings:

  - You are about to drop the column `coverImageUrl` on the `Book` table. All the data in the column will be lost.
  - You are about to drop the column `isPublished` on the `Book` table. All the data in the column will be lost.
  - You are about to drop the column `priceCents` on the `Book` table. All the data in the column will be lost.
  - You are about to drop the column `profileId` on the `Book` table. All the data in the column will be lost.
  - You are about to drop the column `prompt` on the `Book` table. All the data in the column will be lost.
  - You are about to drop the column `slug` on the `Book` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Book` table. All the data in the column will be lost.
  - Made the column `description` on table `Book` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "Book_slug_key";

-- AlterTable
ALTER TABLE "Book" DROP COLUMN "coverImageUrl",
DROP COLUMN "isPublished",
DROP COLUMN "priceCents",
DROP COLUMN "profileId",
DROP COLUMN "prompt",
DROP COLUMN "slug",
DROP COLUMN "updatedAt",
ALTER COLUMN "description" SET NOT NULL;
