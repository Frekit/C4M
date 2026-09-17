-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "settlementMode" TEXT NOT NULL DEFAULT 'PER_CONTENT',
    "requiresPlatformSubmit" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "Client_name_key" ON "Client"("name");

INSERT INTO "Client" ("id", "name", "settlementMode", "requiresPlatformSubmit", "createdAt", "updatedAt")
SELECT lower(hex(randomblob(12))), "clientName", 'PER_CONTENT', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT "clientName" FROM "Campaign"
    WHERE "clientName" IS NOT NULL AND trim("clientName") != ''
);

-- RedefineTable
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Campaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "clientId" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startsAt" DATETIME,
    "endsAt" DATETIME,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Campaign_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Campaign" ("id", "name", "clientId", "description", "status", "startsAt", "endsAt", "createdBy", "createdAt", "updatedAt")
SELECT "Campaign"."id", "Campaign"."name", "Client"."id", "Campaign"."description", "Campaign"."status", "Campaign"."startsAt", "Campaign"."endsAt", "Campaign"."createdBy", "Campaign"."createdAt", "Campaign"."updatedAt"
FROM "Campaign"
LEFT JOIN "Client" ON "Client"."name" = "Campaign"."clientName";
DROP TABLE "Campaign";
ALTER TABLE "new_Campaign" RENAME TO "Campaign";
CREATE UNIQUE INDEX "Campaign_name_key" ON "Campaign"("name");
CREATE INDEX "Campaign_status_idx" ON "Campaign"("status");
CREATE INDEX "Campaign_clientId_idx" ON "Campaign"("clientId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
