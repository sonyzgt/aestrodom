-- AlterTable
ALTER TABLE "CreditOrder" ADD COLUMN     "tokenUsd" TEXT,
ADD COLUMN     "usdCents" INTEGER NOT NULL DEFAULT 0;

