/**
 * Loads the capture pages' shared context: the Vyooom session + which storage
 * destination to default to. Degrades gracefully if the backend is unreachable
 * (still lets you record; the upload step will surface any error).
 */
import { useEffect, useState } from "react";
import { StorageProvider } from "@flowcap/shared";
import { api } from "./api.js";
import { getSession, type Session } from "./storage.js";

export interface FlowcapContext {
  loading: boolean;
  session: Session | null;
  driveConnected: boolean;
  defaultDestination: StorageProvider;
}

export function useFlowcap(): FlowcapContext {
  const [ctx, setCtx] = useState<FlowcapContext>({
    loading: true,
    session: null,
    driveConnected: false,
    defaultDestination: StorageProvider.FLOWCAP,
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const session = await getSession();
      let driveConnected = false;
      let defaultDestination: StorageProvider = StorageProvider.FLOWCAP;
      if (session) {
        try {
          const status = await api.storageStatus();
          driveConnected = status.connections.some(
            (c) => c.provider === StorageProvider.DRIVE && c.isActive,
          );
          defaultDestination = status.defaultProvider;
        } catch {
          /* backend unreachable — defaults stand */
        }
      }
      if (!cancelled) setCtx({ loading: false, session, driveConnected, defaultDestination });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return ctx;
}
