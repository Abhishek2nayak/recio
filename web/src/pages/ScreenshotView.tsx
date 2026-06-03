import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import type { ScreenshotDTO } from "@flowcap/shared";
import { ApiError, api } from "../lib/api.js";
import { MediaDetail } from "../components/MediaDetail.js";
import { DetailError, DetailSkeleton } from "../components/DetailStates.js";

export function ScreenshotView() {
  const { id = "" } = useParams();
  const [screenshot, setScreenshot] = useState<ScreenshotDTO | null>(null);
  const [playbackUrl, setPlaybackUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .getScreenshot(id)
      .then((d) => {
        if (cancelled) return;
        setScreenshot(d.screenshot);
        setPlaybackUrl(d.playbackUrl);
      })
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : "Couldn't load this screenshot."),
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) return <DetailSkeleton />;
  if (error || !screenshot) return <DetailError message={error ?? "Not found."} />;

  return (
    <MediaDetail
      media={screenshot}
      playbackUrl={playbackUrl}
      onRename={async (title) => {
        const { screenshot: updated } = await api.updateScreenshot(id, { title });
        setScreenshot(updated);
      }}
      onDelete={() => api.deleteScreenshot(id).then(() => undefined)}
    />
  );
}
