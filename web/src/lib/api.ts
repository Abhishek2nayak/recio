/**
 * Backend API client for the web app. Attaches the in-memory access token,
 * unwraps the `{ success, data }` envelope, and refreshes once on an expired token
 * (refresh cookie travels via `credentials: "include"`).
 */
import type {
  AnalyticsDTO,
  ApiResponse,
  BrandingDTO,
  CheckoutInput,
  CleanupResultDTO,
  CreateShareInput,
  InviteDTO,
  MemberDTO,
  RecordViewInput,
  StreamUsageDTO,
  TranscriptDTO,
  UpdateBrandingInput,
  WorkspaceDTO,
  LinkVisibility,
  ListMediaQuery,
  CommentDTO,
  CreateCommentInput,
  Paginated,
  PublicShareViewDTO,
  ReactInput,
  ReactionCounts,
  RecordingDTO,
  ScreenshotDTO,
  StorageConnectionDTO,
  StorageProvider,
  UpdateMediaInput,
  UserDTO,
} from "@flowcap/shared";
import { config } from "./config.js";
import { getAccessToken, setAccessToken } from "./authToken.js";

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
    this.name = "ApiError";
  }
}

interface Options {
  method?: string;
  body?: unknown;
  auth?: boolean;
  query?: Record<string, string | number | undefined>;
  _retried?: boolean;
}

function buildUrl(path: string, query?: Options["query"]): string {
  const url = new URL(`${config.apiBaseUrl}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

async function request<T>(path: string, opts: Options = {}): Promise<T> {
  const { method = "GET", body, auth = true, query } = opts;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(buildUrl(path, query), {
    method,
    headers,
    credentials: "include",
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const json = (await res.json().catch(() => null)) as ApiResponse<T> | null;
  if (json && json.success) return json.data;

  const code = json && !json.success ? json.error.code : "INTERNAL_ERROR";
  const message = json && !json.success ? json.error.message : `Request failed (${res.status}).`;

  if (code === "TOKEN_EXPIRED" && auth && !opts._retried) {
    if (await tryRefresh()) return request<T>(path, { ...opts, _retried: true });
  }
  // A gated feature (HTTP 402): surface the upsell globally so any caller triggers it.
  if (code === "UPGRADE_REQUIRED" && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("recio:upgrade-required", { detail: { message } }));
  }
  throw new ApiError(code, message, res.status);
}

async function tryRefresh(): Promise<boolean> {
  try {
    const data = await request<{ accessToken: string; user: UserDTO }>("/auth/refresh", {
      method: "POST",
      auth: false,
    });
    setAccessToken(data.accessToken);
    return true;
  } catch {
    setAccessToken(null);
    return false;
  }
}

export interface StorageStatus {
  connections: StorageConnectionDTO[];
  defaultProvider: StorageProvider;
  driveQuota: { used: number; limit: number | null } | null;
}

export const api = {
  // auth
  register: (b: { email: string; password: string; name?: string }) =>
    request<{ accessToken: string; user: UserDTO }>("/auth/register", { method: "POST", body: b, auth: false }),
  login: (b: { email: string; password: string }) =>
    request<{ accessToken: string; user: UserDTO }>("/auth/login", { method: "POST", body: b, auth: false }),
  google: (idToken: string) =>
    request<{ accessToken: string; user: UserDTO }>("/auth/google", { method: "POST", body: { idToken }, auth: false }),
  refresh: () =>
    request<{ accessToken: string; user: UserDTO }>("/auth/refresh", { method: "POST", auth: false }),
  me: () => request<{ user: UserDTO }>("/auth/me"),
  logout: () => request<{ loggedOut: boolean }>("/auth/logout", { method: "POST", auth: false }),

  // storage (pass quota:true only where the quota bar is shown — it's a Drive round-trip)
  storageStatus: (quota = false) =>
    request<StorageStatus>("/storage/status", { query: quota ? { quota: "1" } : undefined }),
  driveConsentUrl: () => request<{ url: string }>("/storage/drive/connect"),
  driveDisconnect: () => request<{ disconnected: boolean }>("/storage/drive/disconnect", { method: "DELETE" }),
  dropboxConsentUrl: () => request<{ url: string }>("/storage/dropbox/connect"),
  dropboxDisconnect: () => request<{ disconnected: boolean }>("/storage/dropbox/disconnect", { method: "DELETE" }),
  setDefaultProvider: (provider: StorageProvider) =>
    request<{ defaultProvider: StorageProvider }>("/storage/default", { method: "PATCH", body: { provider } }),

  // recordings
  listRecordings: (q: Partial<ListMediaQuery>) =>
    request<Paginated<RecordingDTO>>("/recordings", { query: q as Record<string, string> }),
  getRecording: (id: string) =>
    request<{ recording: RecordingDTO; playbackUrl: string }>(`/recordings/${id}`),
  updateRecording: (id: string, body: UpdateMediaInput) =>
    request<{ recording: RecordingDTO }>(`/recordings/${id}`, { method: "PATCH", body }),
  deleteRecording: (id: string) => request<{ deleted: boolean }>(`/recordings/${id}`, { method: "DELETE" }),

  // screenshots
  listScreenshots: (q: Partial<ListMediaQuery>) =>
    request<Paginated<ScreenshotDTO>>("/screenshots", { query: q as Record<string, string> }),
  getScreenshot: (id: string) =>
    request<{ screenshot: ScreenshotDTO; playbackUrl: string }>(`/screenshots/${id}`),
  updateScreenshot: (id: string, body: UpdateMediaInput) =>
    request<{ screenshot: ScreenshotDTO }>(`/screenshots/${id}`, { method: "PATCH", body }),
  deleteScreenshot: (id: string) => request<{ deleted: boolean }>(`/screenshots/${id}`, { method: "DELETE" }),

  // share
  createShare: (body: CreateShareInput) => request<{ shareUrl: string }>("/share", { method: "POST", body }),
  resolveShare: (token: string) => request<PublicShareViewDTO>(`/share/${token}`, { auth: false }),
  updateSharePermission: (token: string, visibility: LinkVisibility) =>
    request<{ token: string; visibility: LinkVisibility }>(`/share/${token}/permissions`, {
      method: "PATCH",
      body: { visibility },
    }),
  deleteShare: (token: string) => request<{ revoked: boolean }>(`/share/${token}`, { method: "DELETE" }),

  // reactions (public)
  getReactions: (resourceId: string) =>
    request<{ counts: ReactionCounts }>(`/reactions/${resourceId}`, { auth: false }),
  react: (body: ReactInput) =>
    request<{ counts: ReactionCounts }>("/reactions", { method: "POST", body, auth: false }),

  // comments (public read; post optionally authed)
  getComments: (resourceId: string) =>
    request<{ comments: CommentDTO[] }>(`/comments/${resourceId}`, { auth: false }),
  addComment: (body: CreateCommentInput, authed: boolean) =>
    request<{ comment: CommentDTO }>("/comments", { method: "POST", body, auth: authed }),

  // analytics
  recordView: (body: RecordViewInput) =>
    request<{ recorded: boolean }>("/analytics/view", { method: "POST", body, auth: false }),
  getAnalytics: (id: string) => request<AnalyticsDTO>(`/analytics/${id}`),

  // branding (Pro)
  getBranding: () => request<BrandingDTO>("/branding"),
  updateBranding: (body: UpdateBrandingInput) =>
    request<BrandingDTO>("/branding", { method: "PATCH", body }),

  // billing
  startCheckout: (body: CheckoutInput) =>
    request<{ url: string }>("/billing/checkout", { method: "POST", body }),
  billingPortal: () => request<{ url: string }>("/billing/portal", { method: "POST" }),

  // usage
  getUsage: () => request<StreamUsageDTO>("/usage"),

  // AI transcript
  getTranscript: (id: string) =>
    request<{ transcript: TranscriptDTO | null }>(`/recordings/${id}/transcript`),
  generateTranscript: (id: string) =>
    request<{ transcript: TranscriptDTO }>(`/recordings/${id}/transcript`, { method: "POST" }),

  // smart cleanup
  runCleanup: (id: string) =>
    request<{ cleanup: CleanupResultDTO }>(`/recordings/${id}/cleanup`, { method: "POST" }),
  clearCleanup: (id: string) =>
    request<{ cleared: boolean }>(`/recordings/${id}/cleanup`, { method: "DELETE" }),

  // workspaces (Business)
  listWorkspaces: () => request<{ workspaces: WorkspaceDTO[] }>("/workspaces"),
  createWorkspace: (name: string) =>
    request<{ workspace: WorkspaceDTO }>("/workspaces", { method: "POST", body: { name } }),
  workspaceMembers: (id: string) => request<{ members: MemberDTO[] }>(`/workspaces/${id}/members`),
  workspaceInvites: (id: string) => request<{ invites: InviteDTO[] }>(`/workspaces/${id}/invites`),
  inviteMember: (id: string, email: string, role: "ADMIN" | "MEMBER") =>
    request<{ invite: InviteDTO }>(`/workspaces/${id}/invites`, { method: "POST", body: { email, role } }),
  revokeInvite: (id: string, inviteId: string) =>
    request<{ revoked: boolean }>(`/workspaces/${id}/invites/${inviteId}`, { method: "DELETE" }),
  setMemberRole: (id: string, userId: string, role: "ADMIN" | "MEMBER") =>
    request<{ updated: boolean }>(`/workspaces/${id}/members/${userId}`, { method: "PATCH", body: { role } }),
  removeMember: (id: string, userId: string) =>
    request<{ removed: boolean }>(`/workspaces/${id}/members/${userId}`, { method: "DELETE" }),
  acceptInvite: (token: string) =>
    request<{ workspace: WorkspaceDTO }>(`/workspaces/invites/${token}/accept`, { method: "POST" }),
};
