import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import type { RecordingDTO } from "@flowcap/shared";
import { ApiError, api } from "../lib/api.js";
import { MediaDetail } from "../components/MediaDetail.js";
import { MediaView } from "../components/MediaView.js";
import { DetailError, DetailSkeleton } from "../components/DetailStates.js";

export function RecordingView({ edit = false }: { edit?: boolean }) {
  const { id = "" } = useParams();
  const [recording, setRecording] = useState<RecordingDTO | null>(null);
  const [playbackUrl, setPlaybackUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .getRecording(id)
      .then((d) => {
        if (cancelled) return;
        setRecording(d.recording);
        setPlaybackUrl(d.playbackUrl ?? "");
      })
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : "Couldn't load this recording."),
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) return <DetailSkeleton />;
  if (error || !recording) return <DetailError message={error ?? "Not found."} />;

  const rename = async (title: string) => {
    const { recording: updated } = await api.updateRecording(id, { title });
    setRecording(updated);
  };

  if (!edit) return <MediaView media={recording} playbackUrl={playbackUrl} onRename={rename} />;

  return (
    <MediaDetail
      media={recording}
      playbackUrl={playbackUrl}
      onRename={rename}
      onDelete={() => api.deleteRecording(id).then(() => undefined)}
    />
  );
}
