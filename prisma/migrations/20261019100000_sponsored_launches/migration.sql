-- CreateTable
CREATE TABLE "SponsoredLaunch" (
    "id" TEXT NOT NULL,
    "passTokenId" INTEGER NOT NULL,
    "day" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "transactionHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SponsoredLaunch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SponsoredLaunch_transactionHash_key" ON "SponsoredLaunch"("transactionHash");

-- CreateIndex
CREATE INDEX "SponsoredLaunch_day_idx" ON "SponsoredLaunch"("day");

-- CreateIndex
CREATE INDEX "SponsoredLaunch_userId_idx" ON "SponsoredLaunch"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SponsoredLaunch_passTokenId_day_key" ON "SponsoredLaunch"("passTokenId", "day");

-- AddForeignKey
ALTER TABLE "SponsoredLaunch" ADD CONSTRAINT "SponsoredLaunch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
