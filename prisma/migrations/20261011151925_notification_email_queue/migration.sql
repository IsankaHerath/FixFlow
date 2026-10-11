-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "emailAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "emailClaimedAt" TIMESTAMP(3),
ADD COLUMN     "emailStatus" TEXT NOT NULL DEFAULT 'PENDING';
