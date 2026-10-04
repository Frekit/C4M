-- AlterTable
ALTER TABLE "Creator" ADD COLUMN "defaultCostMinor" INTEGER;
ALTER TABLE "Creator" ADD COLUMN "defaultCostCurrency" TEXT;

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN "engagementKind" TEXT NOT NULL DEFAULT 'ALWAYS_ON';
ALTER TABLE "Campaign" ADD COLUMN "approvalMode" TEXT NOT NULL DEFAULT 'INTERNAL';
ALTER TABLE "Campaign" ADD COLUMN "budgetSaleCents" INTEGER;
ALTER TABLE "Campaign" ADD COLUMN "defaultPaymentTermDays" INTEGER NOT NULL DEFAULT 30;

-- AlterTable
ALTER TABLE "CampaignTalent" ADD COLUMN "deliverableCount" INTEGER;
ALTER TABLE "CampaignTalent" ADD COLUMN "proposalId" TEXT;

-- CreateTable
CREATE TABLE "CampaignProposal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "sentAt" DATETIME,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CampaignProposal_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "CampaignProposal_campaignId_status_idx" ON "CampaignProposal"("campaignId", "status");

-- Always-on: el mismo perfil puede tener otra pasada en la misma campaña.
DROP INDEX IF EXISTS "CampaignTalent_campaignId_creatorId_key";
CREATE INDEX "CampaignTalent_campaignId_creatorId_idx" ON "CampaignTalent"("campaignId", "creatorId");
CREATE INDEX "CampaignTalent_proposalId_idx" ON "CampaignTalent"("proposalId");
