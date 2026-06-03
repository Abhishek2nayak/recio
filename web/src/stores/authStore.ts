/** Auth state (Zustand). The access token lives in `authToken.ts`; this holds the
 *  user + status and drives protected-route gating. */
import { create } from "zustand";
import type { UserDTO } from "@flowcap/shared";
import { api } from "../lib/api.js";
import { setAccessToken } from "../lib/authToken.js";

type Status = "loading" | "authed" | "guest";

interface AuthState {
  user: UserDTO | null;
  status: Status;
  /** Restore a session on app load via the refresh cookie. */
  init: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: UserDTO) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: "loading",

  init: async () => {
    try {
      const { accessToken, user } = await api.refresh();
      setAccessToken(accessToken);
      set({ user, status: "authed" });
    } catch {
      setAccessToken(null);
      set({ user: null, status: "guest" });
    }
  },

  login: async (email, password) => {
    const { accessToken, user } = await api.login({ email, password });
    setAccessToken(accessToken);
    set({ user, status: "authed" });
  },

  loginWithGoogle: async (idToken) => {
    const { accessToken, user } = await api.google(idToken);
    setAccessToken(accessToken);
    set({ user, status: "authed" });
  },

  register: async (email, password, name) => {
    const { accessToken, user } = await api.register({ email, password, name });
    setAccessToken(accessToken);
    set({ user, status: "authed" });
  },

  logout: async () => {
    await api.logout().catch(() => {});
    setAccessToken(null);
    set({ user: null, status: "guest" });
  },

  setUser: (user) => set({ user }),
}));
