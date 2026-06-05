-- CreateTable
CREATE TABLE "ViewEvent" (
    "id" TEXT NOT NULL,
    "resourceType" "ResourceType" NOT NULL,
    "resourceId" TEXT NOT NULL,
    "viewerId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "watchedPct" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ViewEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ViewEvent_sessionId_key" ON "ViewEvent"("sessionId");

-- CreateIndex
CREATE INDEX "ViewEvent_resourceId_createdAt_idx" ON "ViewEvent"("resourceId", "createdAt");
