-- AI caption translations, cached one row per (recording, language).
CREATE TABLE "TranscriptTranslation" (
    "id" TEXT NOT NULL,
    "recordingId" TEXT NOT NULL,
    "lang" TEXT NOT NULL,
    "cues" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TranscriptTranslation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TranscriptTranslation_recordingId_lang_key" ON "TranscriptTranslation"("recordingId", "lang");
CREATE INDEX "TranscriptTranslation_recordingId_idx" ON "TranscriptTranslation"("recordingId");
