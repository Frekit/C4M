-- RedefineTable
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AgentApproval" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "toolCallId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_AgentApproval" ("id", "toolCallId", "userId", "toolName", "createdAt")
SELECT "id", "id", "userId", "toolName", "createdAt" FROM "AgentApproval";
DROP TABLE "AgentApproval";
ALTER TABLE "new_AgentApproval" RENAME TO "AgentApproval";
CREATE UNIQUE INDEX "AgentApproval_toolCallId_key" ON "AgentApproval"("toolCallId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
