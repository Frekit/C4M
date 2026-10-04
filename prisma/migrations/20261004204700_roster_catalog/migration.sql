-- CreateTable
CREATE TABLE "RosterOption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "aliases" TEXT NOT NULL DEFAULT '[]',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "RosterOption_kind_slug_key" ON "RosterOption"("kind", "slug");

-- CreateIndex
CREATE INDEX "RosterOption_kind_archivedAt_idx" ON "RosterOption"("kind", "archivedAt");
