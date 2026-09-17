-- CreateIndex
CREATE INDEX "Contract_status_createdAt_idx" ON "Contract"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Deliverable_contractId_idx" ON "Deliverable"("contractId");

-- CreateIndex
CREATE INDEX "Deliverable_status_campaignId_paidAt_idx" ON "Deliverable"("status", "campaignId", "paidAt");

-- CreateIndex
CREATE INDEX "Deliverable_status_paidAt_idx" ON "Deliverable"("status", "paidAt");

-- CreateIndex
CREATE INDEX "SignatureRequest_status_expiresAt_idx" ON "SignatureRequest"("status", "expiresAt");

-- CreateTable
CREATE TABLE "MailJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "contractId" TEXT,
    "signatureRequestId" TEXT,
    "subject" TEXT NOT NULL,
    "textBody" TEXT NOT NULL,
    "htmlBody" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" DATETIME
);

-- CreateIndex
CREATE INDEX "MailJob_status_createdAt_idx" ON "MailJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "MailJob_contractId_idx" ON "MailJob"("contractId");
