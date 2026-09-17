-- AlterTable
ALTER TABLE "Deliverable" ADD COLUMN "postUrlKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Deliverable_postUrlKey_key" ON "Deliverable"("postUrlKey");
