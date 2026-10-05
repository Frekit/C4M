-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN "briefObjective" TEXT;
ALTER TABLE "Campaign" ADD COLUMN "briefAudience" TEXT;
ALTER TABLE "Campaign" ADD COLUMN "briefNetworks" TEXT;
ALTER TABLE "Campaign" ADD COLUMN "briefFormats" TEXT;
ALTER TABLE "Campaign" ADD COLUMN "briefNotes" TEXT;
ALTER TABLE "Campaign" ADD COLUMN "clientAccessToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_clientAccessToken_key" ON "Campaign"("clientAccessToken");

-- CreateTable
CREATE TABLE "CampaignCuration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "stance" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CampaignCuration_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CampaignCuration_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CampaignCuration_campaignId_creatorId_key" ON "CampaignCuration"("campaignId", "creatorId");
CREATE INDEX "CampaignCuration_campaignId_stance_idx" ON "CampaignCuration"("campaignId", "stance");

-- CreateTable
CREATE TABLE "CampaignMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "authorKind" TEXT NOT NULL,
    "authorLabel" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CampaignMessage_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CampaignMessage_campaignId_createdAt_idx" ON "CampaignMessage"("campaignId", "createdAt");
