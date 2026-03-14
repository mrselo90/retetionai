-- CreateTable
CREATE TABLE "Shop" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopDomain" TEXT NOT NULL,
    "planType" TEXT NOT NULL DEFAULT 'STARTER',
    "billingInterval" TEXT NOT NULL DEFAULT 'MONTHLY',
    "subscriptionId" TEXT,
    "subscriptionName" TEXT,
    "subscriptionLineItemId" TEXT,
    "isTrial" BOOLEAN NOT NULL DEFAULT true,
    "currentPeriodEnd" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "UsageTracker" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "chatsSentThisMonth" INTEGER NOT NULL DEFAULT 0,
    "recipesCreatedCount" INTEGER NOT NULL DEFAULT 0,
    "photosAnalyzedCount" INTEGER NOT NULL DEFAULT 0,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UsageTracker_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "externalProductId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Product_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WebhookReceipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "webhookId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "externalReference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "chatIncrementApplied" BOOLEAN NOT NULL DEFAULT false,
    "usageChargeApplied" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WebhookReceipt_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Shop_shopDomain_key" ON "Shop"("shopDomain");

-- CreateIndex
CREATE UNIQUE INDEX "UsageTracker_shopId_key" ON "UsageTracker"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_shopId_externalProductId_key" ON "Product"("shopId", "externalProductId");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookReceipt_webhookId_key" ON "WebhookReceipt"("webhookId");
