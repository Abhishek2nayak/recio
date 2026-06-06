/** Accept a workspace invite link at /invite/:token. Requires sign-in; on success
 *  joins the workspace and redirects to the Team page. */
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api.js";
import { useAuthStore } from "../stores/authStore.js";
import { Button, Spinner } from "../components/ui.js";

export function Invite() {
  const { token } = useParams<{ token: string }>();
  const status = useAuthStore((s) => s.status);
  const navigate = useNavigate();
  const [state, setState] = useState<"working" | "done" | "error" | "guest">("working");

  useEffect(() => {
    if (status === "loading") return;
    if (status === "guest") {
      setState("guest");
      return;
    }
    if (!token) {
      setState("error");
      return;
    }
    api
      .acceptInvite(token)
      .then(() => {
        setState("done");
        setTimeout(() => navigate("/team"), 1000);
      })
      .catch(() => setState("error"));
  }, [status, token, navigate]);

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-16 text-center">
      <div className="max-w-sm">
        {state === "working" && <Spinner className="text-muted" />}
        {state === "done" && (
          <>
            <h1 className="text-lg font-semibold">You're in 🎉</h1>
            <p className="mt-1 text-sm text-muted">Taking you to your team…</p>
          </>
        )}
        {state === "guest" && (
          <>
            <h1 className="text-lg font-semibold">Join the workspace</h1>
            <p className="mt-1 text-sm text-muted">Sign in or create a free account to accept this invite.</p>
            <div className="mt-5 flex justify-center gap-2">
              <Link to="/login">
                <Button variant="secondary">Sign in</Button>
              </Link>
              <Link to="/register">
                <Button>Create account</Button>
              </Link>
            </div>
          </>
        )}
        {state === "error" && (
          <>
            <h1 className="text-lg font-semibold">Invite not valid</h1>
            <p className="mt-1 text-sm text-muted">This invite link is invalid or has expired.</p>
          </>
        )}
      </div>
    </div>
  );
}
