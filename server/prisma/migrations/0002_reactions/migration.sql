-- CreateTable
CREATE TABLE "Reaction" (
    "id" TEXT NOT NULL,
    "resourceType" "ResourceType" NOT NULL,
    "resourceId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Reaction_resourceId_idx" ON "Reaction"("resourceId");

-- CreateIndex
CREATE UNIQUE INDEX "Reaction_resourceId_emoji_key" ON "Reaction"("resourceId", "emoji");

