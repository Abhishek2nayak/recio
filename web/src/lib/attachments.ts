/**
 * Comment attachments: mint a signed direct-to-storage upload URL, PUT the file
 * straight to storage (the server never sees the bytes), then resolve a durable
 * URL to embed in the comment body. Mirrors the media "Save to Vyooom" path.
 */
import { api } from "./api.js";

export async function uploadCommentAttachment(file: File): Promise<string> {
  const contentType = file.type || "application/octet-stream";
  const { uploadUrl, path } = await api.signCommentAttachment({ filename: file.name, contentType });
  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType, "x-upsert": "true" },
    body: file,
  });
  if (!put.ok) throw new Error("Upload failed. Try a smaller file.");
  const { url } = await api.resolveCommentAttachment(path);
  return url;
}
