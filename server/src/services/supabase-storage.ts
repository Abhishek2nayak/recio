/**
 * Supabase Storage — backs the "Save to FlowCap" path.
 *
 * The server (service-role key) mints a one-time signed UPLOAD url; the client PUTs
 * the bytes straight to Supabase (never through us). Playback uses short-lived
 * signed DOWNLOAD urls so the private bucket is never publicly listed.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ErrorCode } from "@flowcap/shared";
import { env } from "../config/env.js";
import { HttpError } from "../lib/http-error.js";

let client: SupabaseClient | null = null;

function supabase(): SupabaseClient {
  if (!client) {
    client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

const bucket = () => supabase().storage.from(env.SUPABASE_STORAGE_BUCKET);

/** Build an absolute URL from a Supabase-relative path (its SDK returns relatives). */
function absolute(maybeRelative: string): string {
  return maybeRelative.startsWith("http")
    ? maybeRelative
    : `${env.SUPABASE_URL}${maybeRelative.startsWith("/") ? "" : "/"}${maybeRelative}`;
}

export interface SignedUpload {
  path: string;
  signedUrl: string;
  token: string;
}

/** Mint a one-time signed upload URL for `path` (e.g. `userId/recordings/<id>.webm`). */
export async function createSignedUpload(path: string): Promise<SignedUpload> {
  const { data, error } = await bucket().createSignedUploadUrl(path);
  if (error || !data) {
    throw new HttpError(ErrorCode.UPLOAD_FAILED, `Supabase signed upload failed: ${error?.message}`);
  }
  return { path: data.path, signedUrl: absolute(data.signedUrl), token: data.token };
}

/** Short-lived signed download URL used for playback of FlowCap-stored media. */
export async function createSignedDownloadUrl(
  path: string,
  ttlSeconds = env.SIGNED_URL_TTL,
): Promise<string> {
  const { data, error } = await bucket().createSignedUrl(path, ttlSeconds);
  if (error || !data) {
    throw new HttpError(ErrorCode.DRIVE_API_ERROR, `Supabase signed url failed: ${error?.message}`);
  }
  return absolute(data.signedUrl);
}

/** Delete an object (best-effort; used on media delete). */
export async function removeObject(path: string): Promise<void> {
  const { error } = await bucket().remove([path]);
  if (error) {
    throw new HttpError(ErrorCode.DRIVE_API_ERROR, `Supabase remove failed: ${error.message}`);
  }
}
