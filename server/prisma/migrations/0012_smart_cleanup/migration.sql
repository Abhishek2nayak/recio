-- AlterTable
ALTER TABLE "Transcript" ADD COLUMN "words" JSONB;
ALTER TABLE "Recording" ADD COLUMN "cuts" JSONB;
