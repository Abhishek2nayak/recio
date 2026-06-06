-- CreateEnum
CREATE TYPE "TranscriptStatus" AS ENUM ('PROCESSING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "Transcript" (
    "id" TEXT NOT NULL,
    "recordingId" TEXT NOT NULL,
    "status" "TranscriptStatus" NOT NULL DEFAULT 'PROCESSING',
    "language" TEXT,
    "title" TEXT,
    "summary" TEXT,
    "text" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transcript_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Transcript_recordingId_key" ON "Transcript"("recordingId");
CREATE INDEX "Transcript_recordingId_idx" ON "Transcript"("recordingId");
