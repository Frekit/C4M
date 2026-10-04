-- CreateTable
CREATE TABLE "CreatorCostQuote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "creatorId" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'INSTAGRAM',
    "format" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "costMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CreatorCostQuote_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CreatorCostQuote_creatorId_platform_format_quantity_key" ON "CreatorCostQuote"("creatorId", "platform", "format", "quantity");
CREATE INDEX "CreatorCostQuote_creatorId_idx" ON "CreatorCostQuote"("creatorId");
