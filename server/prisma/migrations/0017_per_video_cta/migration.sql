-- Per-video call-to-action button (overrides the account-level CTA on the share page).
ALTER TABLE "Recording" ADD COLUMN "ctaLabel" TEXT;
ALTER TABLE "Recording" ADD COLUMN "ctaUrl" TEXT;
