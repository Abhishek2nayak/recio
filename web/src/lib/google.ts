/**
 * Google Identity Services (GIS) loader for "Sign in with Google". Lazily injects
 * the GIS script and resolves the returned ID token, which the backend verifies.
 * No-ops cleanly when VITE_GOOGLE_CLIENT_ID isn't set.
 */
import { config } from "./config.js";

interface GoogleCredentialResponse {
  credential: string;
}
interface GoogleIdApi {
  initialize: (opts: {
    client_id: string;
    callback: (res: GoogleCredentialResponse) => void;
    auto_select?: boolean;
  }) => void;
  prompt: (listener?: (notification: { isNotDisplayed: () => boolean; isSkippedMoment: () => boolean }) => void) => void;
}
interface GoogleNamespace {
  accounts: { id: GoogleIdApi };
}
declare global {
  interface Window {
    google?: GoogleNamespace;
  }
}

export const googleConfigured = (): boolean => config.googleClientId.length > 0;

let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load Google sign-in."));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/** Prompt Google sign-in and resolve the ID token. */
export async function signInWithGoogle(): Promise<string> {
  if (!googleConfigured()) {
    throw new Error("Google sign-in isn't configured (set VITE_GOOGLE_CLIENT_ID).");
  }
  await loadScript();
  const id = window.google?.accounts.id;
  if (!id) throw new Error("Google sign-in unavailable.");

  return new Promise<string>((resolve, reject) => {
    id.initialize({
      client_id: config.googleClientId,
      callback: (res) => (res.credential ? resolve(res.credential) : reject(new Error("No credential."))),
    });
    id.prompt((n) => {
      if (n.isNotDisplayed() || n.isSkippedMoment()) {
        reject(new Error("Google sign-in was dismissed."));
      }
    });
  });
}
