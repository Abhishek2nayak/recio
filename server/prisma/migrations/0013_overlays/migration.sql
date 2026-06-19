-- Non-destructive overlays (text / box / blur) drawn over the video at playback.
-- Stored as JSON: [{id,type,x,y,w,h,startSec,endSec,text?,color?}]. null = none.
ALTER TABLE "Recording" ADD COLUMN "overlays" JSONB;
