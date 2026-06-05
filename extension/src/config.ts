/** Build-time config (Vite injects VITE_* at build). Safe defaults so it builds bare. */
export const config = {
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:4000",
  webBaseUrl: (import.meta.env.VITE_WEB_BASE_URL as string | undefined) ?? "http://localhost:5173",
  googleClientId: (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? "",
  dropboxClientId: (import.meta.env.VITE_DROPBOX_CLIENT_ID as string | undefined) ?? "",
} as const;

/** Drive OAuth scopes requested via launchWebAuthFlow. */
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];
