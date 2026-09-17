-- RedefineTable
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Contract" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "parentId" TEXT,
    "rootId" TEXT,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "deliverableCount" INTEGER NOT NULL,
    "salePriceCentsPerContent" INTEGER NOT NULL,
    "costCurrency" TEXT NOT NULL,
    "costMinorPerContent" INTEGER NOT NULL,
    "fxUnitsPerUsd" REAL NOT NULL,
    "fxRateAt" DATETIME NOT NULL,
    "fxSource" TEXT NOT NULL DEFAULT 'MANUAL',
    "costUsdCentsPerContent" INTEGER NOT NULL,
    "paymentTermDays" INTEGER NOT NULL,
    "startsAt" DATETIME,
    "endsAt" DATETIME,
    "signedAt" DATETIME,
    "completedAt" DATETIME,
    "cancelledAt" DATETIME,
    "cancelReason" TEXT,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "clientId" TEXT,
    CONSTRAINT "Contract_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Contract_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Contract" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Contract_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Contract" ("id", "code", "creatorId", "parentId", "rootId", "kind", "status", "deliverableCount", "salePriceCentsPerContent", "costCurrency", "costMinorPerContent", "fxUnitsPerUsd", "fxRateAt", "fxSource", "costUsdCentsPerContent", "paymentTermDays", "startsAt", "endsAt", "signedAt", "completedAt", "cancelledAt", "cancelReason", "notes", "createdBy", "createdAt", "updatedAt")
SELECT "id", "code", "creatorId", "parentId", "rootId", "kind", "status", "deliverableCount", "salePriceCentsPerContent", "costCurrency", "costMinorPerContent", "fxUnitsPerUsd", "fxRateAt", "fxSource", "costUsdCentsPerContent", "paymentTermDays", "startsAt", "endsAt", "signedAt", "completedAt", "cancelledAt", "cancelReason", "notes", "createdBy", "createdAt", "updatedAt" FROM "Contract";
DROP TABLE "Contract";
ALTER TABLE "new_Contract" RENAME TO "Contract";
CREATE UNIQUE INDEX "Contract_code_key" ON "Contract"("code");
CREATE INDEX "Contract_creatorId_idx" ON "Contract"("creatorId");
CREATE INDEX "Contract_rootId_idx" ON "Contract"("rootId");
CREATE INDEX "Contract_status_idx" ON "Contract"("status");
CREATE INDEX "Contract_clientId_idx" ON "Contract"("clientId");

UPDATE "Contract"
SET "clientId" = (
    SELECT "Campaign"."clientId"
    FROM "Deliverable"
    JOIN "Campaign" ON "Campaign"."id" = "Deliverable"."campaignId"
    WHERE "Deliverable"."contractId" = "Contract"."id"
      AND "Campaign"."clientId" IS NOT NULL
    LIMIT 1
)
WHERE "clientId" IS NULL;

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
