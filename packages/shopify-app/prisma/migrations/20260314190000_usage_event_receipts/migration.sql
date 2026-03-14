-- CreateTable
CREATE TABLE "UsageEventReceipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "usageApplied" BOOLEAN NOT NULL DEFAULT false,
    "chargedUnits" INTEGER NOT NULL DEFAULT 0,
    "usageRecordId" TEXT,
    "processedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UsageEventReceipt_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "UsageEventReceipt_shopId_eventType_externalEventId_key" ON "UsageEventReceipt"("shopId", "eventType", "externalEventId");
