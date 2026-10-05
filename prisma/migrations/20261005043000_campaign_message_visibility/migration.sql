-- AlterTable
ALTER TABLE "CampaignMessage" ADD COLUMN "visibility" TEXT NOT NULL DEFAULT 'INTERNAL';

-- CreateIndex
CREATE INDEX "CampaignMessage_campaignId_visibility_idx" ON "CampaignMessage"("campaignId", "visibility");
