/**
 * Backend API client. Attaches the stored access token, unwraps the
 * `{ success, data }` envelope, and transparently refreshes once on an expired
 * access token (the refresh token is an httpOnly cookie on the backend origin, so
 * `credentials: "include"` carries it).
 */
import type {
  ApiResponse,
  CreateRecordingInput,
  CreateScreenshotInput,
  CreateShareInput,
  InitiateDriveUploadInput,
  InitiateDriveUploadResult,
  InitiateServerUploadInput,
  InitiateServerUploadResult,
  RecordingDTO,
  ScreenshotDTO,
  StorageConnectionDTO,
  StorageProvider,
  UserDTO,
} from "@flowcap/shared";
import { config } from "../config.js";
import { getSession, setSession } from "./storage.js";

export class ApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "ApiError";
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  auth?: boolean; // attach bearer token (default true)
  _retried?: boolean;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true } = opts;
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (auth) {
    const session = await getSession();
    if (session) headers.Authorization = `Bearer ${session.accessToken}`;
  }

  const res = await fetch(`${config.apiBaseUrl}${path}`, {
    method,
    headers,
    credentials: "include",
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const json = (await res.json().catch(() => null)) as ApiResponse<T> | null;

  if (json && json.success) return json.data;

  const code = json && !json.success ? json.error.code : "INTERNAL_ERROR";
  const message = json && !json.success ? json.error.message : `Request failed (${res.status}).`;

  // One transparent refresh attempt on an expired access token.
  if (code === "TOKEN_EXPIRED" && auth && !opts._retried) {
    const refreshed = await tryRefresh();
    if (refreshed) return request<T>(path, { ...opts, _retried: true });
  }

  throw new ApiError(code, message);
}

async function tryRefresh(): Promise<boolean> {
  try {
    const data = await request<{ accessToken: string; user: UserDTO }>("/auth/refresh", {
      method: "POST",
      auth: false,
    });
    await setSession({ accessToken: data.accessToken, user: data.user });
    return true;
  } catch {
    await setSession(null);
    return false;
  }
}

export const api = {
  // ── auth ──
  register: (body: { email: string; password: string; name?: string }) =>
    request<{ accessToken: string; user: UserDTO }>("/auth/register", { method: "POST", body, auth: false }),
  login: (body: { email: string; password: string }) =>
    request<{ accessToken: string; user: UserDTO }>("/auth/login", { method: "POST", body, auth: false }),
  googleCode: (code: string, redirectUri: string) =>
    request<{ accessToken: string; user: UserDTO }>("/auth/google/code", {
      method: "POST",
      body: { code, redirectUri },
      auth: false,
    }),
  me: () => request<{ user: UserDTO }>("/auth/me"),
  logout: () => request<{ loggedOut: boolean }>("/auth/logout", { method: "POST", auth: false }),

  // ── storage / drive ──
  storageStatus: () =>
    request<{
      connections: StorageConnectionDTO[];
      defaultProvider: StorageProvider;
      driveQuota: { used: number; limit: number | null } | null;
    }>("/storage/status"),
  driveCallback: (code: string, redirectUri: string) =>
    request<{ connection: StorageConnectionDTO }>("/storage/drive/callback", {
      method: "POST",
      body: { code, redirectUri },
    }),
  driveConsentUrl: () => request<{ url: string }>("/storage/drive/connect"),
  setDefaultProvider: (provider: StorageProvider) =>
    request<{ defaultProvider: StorageProvider }>("/storage/default", { method: "PATCH", body: { provider } }),

  // ── upload coordination ──
  initiateDriveUpload: (body: InitiateDriveUploadInput) =>
    request<InitiateDriveUploadResult>("/upload/drive/initiate", { method: "POST", body }),
  initiateServerUpload: (body: InitiateServerUploadInput) =>
    request<InitiateServerUploadResult>("/upload/server", { method: "POST", body }),

  // ── metadata ──
  createRecording: (body: CreateRecordingInput) =>
    request<{ recording: RecordingDTO }>("/recordings", { method: "POST", body }),
  createScreenshot: (body: CreateScreenshotInput) =>
    request<{ screenshot: ScreenshotDTO }>("/screenshots", { method: "POST", body }),

  // ── share ──
  createShare: (body: CreateShareInput) =>
    request<{ shareUrl: string }>("/share", { method: "POST", body }),
};
