-- AlterTable
ALTER TABLE "Deliverable" ADD COLUMN "paidAt" DATETIME;

-- CreateIndex
CREATE INDEX "Deliverable_paidAt_idx" ON "Deliverable"("paidAt");
