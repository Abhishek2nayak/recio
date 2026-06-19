-- Instant share links: a Recording row (and its share token) can now be created at
-- record-stop, BEFORE the bytes finish uploading. uploadStatus tracks the lifecycle:
--   'UPLOADING' → link exists, bytes in flight (share page shows "processing")
--   'READY'     → bytes landed; playback works.
-- Existing rows were all created after upload, hence the READY default.
ALTER TABLE "Recording" ADD COLUMN "uploadStatus" TEXT NOT NULL DEFAULT 'READY';
