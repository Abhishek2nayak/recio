import { Suspense, lazy, useEffect, type ReactNode } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { useAuthStore } from "./stores/authStore.js";
import { AppLayout } from "./components/AppLayout.js";
import { UpgradeModal } from "./components/UpgradeModal.js";
import { Spinner } from "./components/ui.js";

// Code-split each page so first paint (and public pages like /s/:token or /login)
// don't pull the whole dashboard bundle.
const Landing = lazy(() => import("./pages/Landing.js").then((m) => ({ default: m.Landing })));
const Login = lazy(() => import("./pages/Login.js").then((m) => ({ default: m.Login })));
const Register = lazy(() => import("./pages/Register.js").then((m) => ({ default: m.Register })));
const Dashboard = lazy(() => import("./pages/Dashboard.js").then((m) => ({ default: m.Dashboard })));
const Whiteboard = lazy(() => import("./pages/Whiteboard.js").then((m) => ({ default: m.Whiteboard })));
const RecordingView = lazy(() => import("./pages/RecordingView.js").then((m) => ({ default: m.RecordingView })));
const ScreenshotView = lazy(() => import("./pages/ScreenshotView.js").then((m) => ({ default: m.ScreenshotView })));
const Settings = lazy(() => import("./pages/Settings.js").then((m) => ({ default: m.Settings })));
const SharePage = lazy(() => import("./pages/SharePage.js").then((m) => ({ default: m.SharePage })));
const Pricing = lazy(() => import("./pages/Pricing.js").then((m) => ({ default: m.Pricing })));

type Status = "loading" | "authed" | "guest";

export function App() {
  const status = useAuthStore((s) => s.status);
  const init = useAuthStore((s) => s.init);

  useEffect(() => {
    void init();
  }, [init]);

  return (
    <Suspense fallback={<FullScreenSpinner />}>
      <UpgradeModal />
      <Routes>
        {/* Public */}
        <Route path="/" element={<Landing />} />
        <Route
          path="/login"
          element={
            <GuestOnly status={status}>
              <Login />
            </GuestOnly>
          }
        />
        <Route
          path="/register"
          element={
            <GuestOnly status={status}>
              <Register />
            </GuestOnly>
          }
        />
        <Route path="/s/:token" element={<SharePage />} />
        <Route path="/pricing" element={<Pricing />} />
        {/* Public, chrome-less canvas — embedded by the extension studio to record. */}
        <Route path="/whiteboard/embed" element={<Whiteboard />} />

        {/* Protected */}
        <Route element={<Protected status={status} />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/whiteboard" element={<Whiteboard />} />
          <Route path="/recordings/:id" element={<RecordingView />} />
          <Route path="/screenshots/:id" element={<ScreenshotView />} />
          <Route path="/settings" element={<Settings />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

function FullScreenSpinner() {
  return (
    <div className="flex h-full items-center justify-center">
      <Spinner className="text-muted" />
    </div>
  );
}

/** Wraps protected routes in the app shell; redirects guests to /login. */
function Protected({ status }: { status: Status }) {
  if (status === "loading") return <FullScreenSpinner />;
  if (status === "guest") return <Navigate to="/login" replace />;
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}

/** Redirect already-authenticated users away from login/register. */
function GuestOnly({ status, children }: { status: Status; children: ReactNode }) {
  if (status === "loading") return <FullScreenSpinner />;
  if (status === "authed") return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
