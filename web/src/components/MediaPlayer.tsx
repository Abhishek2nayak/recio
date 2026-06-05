/**
 * Renders the media from its playback URL. Every provider — Drive (via our Range
 * proxy), Dropbox, and Recio/Supabase — now resolves to a URL a native element can
 * load directly, so there's no Drive-specific iframe branch anymore.
 */
import { ResourceType, type MediaDTO } from "@flowcap/shared";

export function MediaPlayer({ media, playbackUrl }: { media: MediaDTO; playbackUrl: string }) {
  const isRecording = media.resourceType === ResourceType.RECORDING;

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-black">
      {isRecording ? (
        <video src={playbackUrl} controls className="aspect-video w-full bg-black" />
      ) : (
        <img src={playbackUrl} alt={media.title} className="max-h-[70vh] w-full object-contain" />
      )}
    </div>
  );
}
