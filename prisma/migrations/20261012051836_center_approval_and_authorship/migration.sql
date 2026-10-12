-- AlterTable
ALTER TABLE "ServiceCenter" ADD COLUMN     "approvedAt" TIMESTAMP(3);
-- Preserve the operational status of centers that existed before approval tracking.
UPDATE "ServiceCenter" SET "approvedAt" = "createdAt" WHERE active = true;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
