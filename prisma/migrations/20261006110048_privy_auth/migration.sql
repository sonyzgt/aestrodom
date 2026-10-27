-- AlterTable
ALTER TABLE "User" ADD COLUMN     "privyId" TEXT,
ADD COLUMN     "walletAddress" TEXT,
ALTER COLUMN "email" DROP NOT NULL,
ALTER COLUMN "passwordHash" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_privyId_key" ON "User"("privyId");

