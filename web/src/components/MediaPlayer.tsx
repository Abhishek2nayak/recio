/**
 * Renders the media. Drive-backed items embed Google's native preview iframe (works
 * for the owner without hot-linking); FlowCap-backed items stream from the signed
 * Supabase URL directly.
 */
import { ResourceType, StorageProvider, type MediaDTO } from "@flowcap/shared";

export function MediaPlayer({ media, playbackUrl }: { media: MediaDTO; playbackUrl: string }) {
  const isRecording = media.resourceType === ResourceType.RECORDING;
  const isDrive = media.storageProvider === StorageProvider.DRIVE;

  if (isDrive) {
    return (
      <div className="overflow-hidden rounded-lg border border-border bg-black">
        <iframe
          title={media.title}
          src={`https://drive.google.com/file/d/${media.storageFileId}/preview`}
          allow="autoplay; fullscreen"
          className="aspect-video w-full"
        />
      </div>
    );
  }

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
