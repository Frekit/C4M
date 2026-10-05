-- AlterTable
ALTER TABLE "Creator" ADD COLUMN "igMedianViews" INTEGER;
ALTER TABLE "Creator" ADD COLUMN "igMedianViewsAt" DATETIME;

-- CreateIndex
CREATE INDEX "Creator_igMedianViewsAt_idx" ON "Creator"("igMedianViewsAt");
