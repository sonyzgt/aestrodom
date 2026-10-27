-- AlterTable
ALTER TABLE "PonsLaunch" ADD COLUMN     "logo" TEXT;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "listed" BOOLEAN NOT NULL DEFAULT true;

