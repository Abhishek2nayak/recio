/**
 * Renders the media from its playback URL. Every provider — Drive (via our Range
 * proxy), Dropbox, and Recio/Supabase — resolves to a URL a native element can load
 * directly. An optional `videoRef` lets the caller drive playback (trim clamp / editor
 * scrubbing).
 */
import type { Ref, RefObject } from "react";
import { ResourceType, type MediaDTO } from "@flowcap/shared";

export function MediaPlayer({
  media,
  playbackUrl,
  videoRef,
}: {
  media: MediaDTO;
  playbackUrl: string;
  videoRef?: RefObject<HTMLVideoElement | null>;
}) {
  const isRecording = media.resourceType === ResourceType.RECORDING;

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-black">
      {isRecording ? (
        <video ref={videoRef as Ref<HTMLVideoElement>} src={playbackUrl} controls className="aspect-video w-full bg-black" />
      ) : (
        <img src={playbackUrl} alt={media.title} className="max-h-[70vh] w-full object-contain" />
      )}
    </div>
  );
}
