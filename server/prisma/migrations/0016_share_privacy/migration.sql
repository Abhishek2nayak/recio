-- Privacy pack: optional viewer passcode on a share link.
ALTER TABLE "Share" ADD COLUMN "passwordHash" TEXT;
