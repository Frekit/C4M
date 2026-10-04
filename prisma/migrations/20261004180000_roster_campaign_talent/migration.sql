-- AlterTable
ALTER TABLE "Creator" ADD COLUMN "profileType" TEXT;

-- CreateIndex
CREATE INDEX "Creator_country_idx" ON "Creator"("country");

-- CreateIndex
CREATE INDEX "Creator_profileType_idx" ON "Creator"("profileType");

-- CreateTable
CREATE TABLE "CampaignTalent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ROSTER',
    "salePriceCentsPerContent" INTEGER,
    "costMinorPerContent" INTEGER,
    "costCurrency" TEXT,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CampaignTalent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CampaignTalent_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CampaignTalent_campaignId_creatorId_key" ON "CampaignTalent"("campaignId", "creatorId");

-- CreateIndex
CREATE INDEX "CampaignTalent_creatorId_idx" ON "CampaignTalent"("creatorId");

-- CreateIndex
CREATE INDEX "CampaignTalent_campaignId_status_idx" ON "CampaignTalent"("campaignId", "status");
