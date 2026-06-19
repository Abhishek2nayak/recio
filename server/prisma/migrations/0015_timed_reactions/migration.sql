-- Timestamped reactions: individual emoji events anchored to a moment in the video,
-- powering Loom-style emoji bursts along the player timeline. The existing
-- "Reaction" table keeps the cheap aggregate counts; this table holds the timeline.
CREATE TABLE "ReactionEvent" (
    "id" TEXT NOT NULL,
    "resourceType" "ResourceType" NOT NULL,
    "resourceId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "timestampSec" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReactionEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReactionEvent_resourceId_timestampSec_idx" ON "ReactionEvent"("resourceId", "timestampSec");
