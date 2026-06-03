/** Email/password + Google sign-in / registration for the popup. */
import { useState } from "react";
import { ApiError, api } from "../lib/api.js";
import { sendMessage } from "../lib/messages.js";
import { getSession, setSession, type Session } from "../lib/storage.js";
import { Button, Field, Spinner, TextInput } from "../components/ui.js";

export function AuthForm({ onAuthed }: { onAuthed: (session: Session) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function google() {
    setGoogleLoading(true);
    setError(null);
    try {
      // The flow runs in the service worker (the popup may close when Google's
      // window opens); if we're still here when it finishes, pick up the session.
      const res = await sendMessage({ type: "SIGN_IN_GOOGLE" });
      if (!res.ok) throw new Error(res.error);
      const session = await getSession();
      if (session) onAuthed(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed.");
    } finally {
      setGoogleLoading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data =
        mode === "login"
          ? await api.login({ email, password })
          : await api.register({ email, password, name: name || undefined });
      const session: Session = { accessToken: data.accessToken, user: data.user };
      await setSession(session);
      onAuthed(session);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Is the server running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 p-4">
      <div>
        <h1 className="text-base font-semibold">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
        <p className="text-xs text-muted">Record and save to your own cloud.</p>
      </div>

      {mode === "register" && (
        <Field label="Name">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional" />
        </Field>
      )}
      <Field label="Email">
        <TextInput type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Password">
        <TextInput
          type="password"
          required
          minLength={mode === "register" ? 8 : undefined}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>

      {error && <p className="text-xs text-danger">{error}</p>}

      <Button type="submit" disabled={loading || googleLoading}>
        {loading ? <Spinner /> : mode === "login" ? "Sign in" : "Create account"}
      </Button>

      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted">
        <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
      </div>

      <Button type="button" variant="secondary" onClick={google} disabled={googleLoading || loading}>
        {googleLoading ? <Spinner /> : <GoogleGlyph />}
        Continue with Google
      </Button>

      <button
        type="button"
        className="text-xs text-muted hover:text-text-primary"
        onClick={() => {
          setMode(mode === "login" ? "register" : "login");
          setError(null);
        }}
      >
        {mode === "login" ? "Need an account? Register" : "Have an account? Sign in"}
      </button>
    </form>
  );
}

function GoogleGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
    </svg>
  );
}
