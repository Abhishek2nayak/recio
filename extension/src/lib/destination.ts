/**
 * Destination pre-flight: answers "can the chosen upload destination actually
 * accept a new capture?" BEFORE recording starts, so a free account left on the
 * gated Vyooom Cloud default (or a revoked Drive grant) gets a clear fix-it prompt
 * up front instead of an upgrade error after they've already recorded.
 *
 * Self-healing: when the saved choice is unusable but another provider IS usable,
 * we switch to it (server default first, then Drive → Dropbox → Cloud) and persist
 * the change. Recording to a destination the user owns always beats failing; the
 * launcher displays the resolved destination, so the switch is never silent.
 *
 * Fail-open on network errors: if the API is unreachable we allow recording — the
 * IndexedDB pending-upload safety net already covers upload failure, and refusing
 * to even capture while offline would be strictly worse.
 */
import { StorageProvider } from "@flowcap/shared";
import { api, ApiError } from "./api.js";
import { getSession, getSettings, setSettings } from "./storage.js";

const AUTH_CODES = new Set(["UNAUTHENTICATED", "TOKEN_EXPIRED", "TOKEN_INVALID"]);

export type DestinationBlock = "signed-out" | "locked" | "not-connected" | "reconnect";

type ConnState = "off" | "active" | "broken";

export interface DestinationState {
  ok: boolean;
  provider: StorageProvider;
  block: DestinationBlock | null;
  /** True when we auto-switched away from an unusable saved choice. */
  switched: boolean;
  /** Whether the plan includes Vyooom Cloud (hosted) storage. */
  hostedStorage: boolean;
  drive: ConnState;
  dropbox: ConnState;
  /** True when the API couldn't be reached and connection states are unknown. */
  unverified: boolean;
}

const PROVIDER_LABELS: Record<StorageProvider, string> = {
  [StorageProvider.DRIVE]: "Google Drive",
  [StorageProvider.DROPBOX]: "Dropbox",
  [StorageProvider.FLOWCAP]: "Vyooom Cloud",
};

export function providerLabel(provider: StorageProvider): string {
  return PROVIDER_LABELS[provider];
}

/** User-facing explanation + fix for a blocked destination. */
export function blockMessage(state: DestinationState): string {
  switch (state.block) {
    case "signed-out":
      return "Sign in from the Vyooom toolbar popup before recording.";
    case "locked":
      return "Vyooom Cloud needs a Premium plan. Connect Google Drive or Dropbox to record free to your own storage, or upgrade.";
    case "reconnect":
      return `${providerLabel(state.provider)} access was revoked or expired. Reconnect it to keep recording.`;
    case "not-connected":
      return `${providerLabel(state.provider)} isn't connected. Connect it (or pick another destination) to record.`;
    default:
      return "";
  }
}

function usable(provider: StorageProvider, s: Pick<DestinationState, "hostedStorage" | "drive" | "dropbox">): boolean {
  if (provider === StorageProvider.FLOWCAP) return s.hostedStorage;
  if (provider === StorageProvider.DRIVE) return s.drive === "active";
  return s.dropbox === "active";
}

function blockFor(provider: StorageProvider, s: Pick<DestinationState, "hostedStorage" | "drive" | "dropbox">): DestinationBlock {
  if (provider === StorageProvider.FLOWCAP) return "locked";
  const conn = provider === StorageProvider.DRIVE ? s.drive : s.dropbox;
  return conn === "broken" ? "reconnect" : "not-connected";
}

export async function resolveDestination(): Promise<DestinationState> {
  const [session, settings] = await Promise.all([getSession(), getSettings()]);
  const chosen = settings.destination;

  if (!session) {
    return {
      ok: false,
      provider: chosen,
      block: "signed-out",
      switched: false,
      hostedStorage: false,
      drive: "off",
      dropbox: "off",
      unverified: true,
    };
  }

  const hostedStorage = session.user.entitlements?.hostedStorage ?? false;

  let drive: ConnState = "off";
  let dropbox: ConnState = "off";
  let serverDefault: StorageProvider | null = null;
  try {
    const status = await api.storageStatus();
    const state = (provider: StorageProvider): ConnState => {
      const conn = status.connections.find((c) => c.provider === provider);
      if (!conn) return "off";
      return conn.isActive ? "active" : "broken";
    };
    drive = state(StorageProvider.DRIVE);
    dropbox = state(StorageProvider.DROPBOX);
    serverDefault = status.defaultProvider;
  } catch (err) {
    // An auth failure (expired session that couldn't refresh) is a real block —
    // publishing would fail the same way. Anything else (offline, server down)
    // fails open: capture must still work; upload errors stay recoverable.
    if (err instanceof ApiError && AUTH_CODES.has(err.code)) {
      return {
        ok: false,
        provider: chosen,
        block: "signed-out",
        switched: false,
        hostedStorage,
        drive,
        dropbox,
        unverified: true,
      };
    }
    return {
      ok: true,
      provider: chosen,
      block: null,
      switched: false,
      hostedStorage,
      drive,
      dropbox,
      unverified: true,
    };
  }

  const base = { hostedStorage, drive, dropbox };
  if (usable(chosen, base)) {
    return { ok: true, provider: chosen, block: null, switched: false, ...base, unverified: false };
  }

  // Saved choice is unusable — adopt the first usable alternative and persist it.
  const candidates: StorageProvider[] = [
    ...(serverDefault ? [serverDefault] : []),
    StorageProvider.DRIVE,
    StorageProvider.DROPBOX,
    StorageProvider.FLOWCAP,
  ];
  const next = candidates.find((p) => usable(p, base));
  if (next) {
    await setSettings({ destination: next });
    api.setDefaultProvider(next).catch(() => {}); // best-effort server sync
    return { ok: true, provider: next, block: null, switched: true, ...base, unverified: false };
  }

  return { ok: false, provider: chosen, block: blockFor(chosen, base), switched: false, ...base, unverified: false };
}
