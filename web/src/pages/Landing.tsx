/**
 * Recio marketing landing — light, calm, editorial (serif display headline, soft
 * teal→blue gradient, floating cards). Self-contained light theme; the rest of the
 * app stays dark.
 */
import { Link } from "react-router-dom";
import { useAuthStore } from "../stores/authStore.js";
import { Logo } from "../components/icons.js";

const NAV = [
  { label: "How it works", href: "#how" },
  { label: "Features", href: "#features" },
  { label: "Your storage", href: "#storage" },
];

export function Landing() {
  const authed = useAuthStore((s) => s.status === "authed");

  return (
    <div className="min-h-full bg-white text-[#0b1220]">
      {/* Nav */}
      <header className="sticky top-0 z-20 mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2">
          <Logo width={28} height={28} />
          <span className="text-lg font-semibold tracking-tight">Recio</span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-slate-600 md:flex">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="transition-colors hover:text-slate-900">
              {n.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          {authed ? (
            <Link to="/dashboard" className="rounded-full bg-[#0b1220] px-4 py-2 text-sm font-medium text-white transition-transform hover:scale-[1.02]">
              Open dashboard
            </Link>
          ) : (
            <>
              <Link to="/login" className="text-sm text-slate-600 hover:text-slate-900">
                Log in
              </Link>
              <Link to="/register" className="rounded-full bg-[#0b1220] px-4 py-2 text-sm font-medium text-white transition-transform hover:scale-[1.02]">
                Get started
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Soft brand gradient wash */}
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(60% 50% at 50% -10%, rgba(34,211,238,0.18), transparent 70%), radial-gradient(50% 40% at 85% 20%, rgba(59,130,246,0.16), transparent 70%), radial-gradient(45% 40% at 12% 30%, rgba(45,212,191,0.16), transparent 70%)",
          }}
        />
        <div className="dot-grid-light pointer-events-none absolute inset-0 -z-10 opacity-60" />

        <div className="mx-auto max-w-3xl px-6 pt-20 pb-10 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs font-medium text-slate-600 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-400" /> Your storage. Your videos. Your control.
          </span>

          <h1 className="font-display mt-6 text-5xl font-semibold leading-[1.05] text-[#0b1220] sm:text-6xl">
            Your videos deserve a<br className="hidden sm:block" /> home that's truly yours.
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-lg text-slate-600">
            Record your screen and webcam, drop a comment, share a link — and keep every recording in your
            own Google Drive, Dropbox, or Recio cloud. No caps, no lock-in.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to={authed ? "/dashboard" : "/register"}
              className="rounded-full bg-[#0b1220] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition-transform hover:scale-[1.03]"
            >
              {authed ? "Go to your library" : "Start recording — free"}
            </Link>
            <a
              href="#how"
              className="rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300"
            >
              See how it works
            </a>
          </div>
        </div>

        {/* Floating preview cards */}
        <div className="relative mx-auto mt-6 flex max-w-4xl justify-center px-6 pb-24">
          <FloatCard className="mr-[-28px] mt-10 rotate-[-7deg]" title="Sprint demo — week 12" views={128} hue="#2DD4BF" />
          <FloatCard className="z-10 scale-[1.06]" title="How to fix the onboarding bug" views={402} hue="#22D3EE" featured />
          <FloatCard className="ml-[-28px] mt-12 rotate-[7deg]" title="Design review walkthrough" views={64} hue="#3B82F6" />
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-5xl px-6 py-20">
        <h2 className="font-display text-center text-3xl font-semibold text-[#0b1220]">
          Everything you need to record &amp; share
        </h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          {[
            { t: "Record anything", d: "Full screen, a window, or a tab — with your webcam bubble and mic. Pause, resume, countdown." },
            { t: "Share in a click", d: "Every recording gets a link with reactions and time-stamped comments. Flip it public or private instantly." },
            { t: "Your storage", d: "Saves straight to your Google Drive, Dropbox, or Recio cloud. You own the files — always." },
          ].map((f) => (
            <div key={f.t} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-base font-semibold text-[#0b1220]">{f.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="bg-slate-50">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <h2 className="font-display text-center text-3xl font-semibold text-[#0b1220]">Three steps. That's it.</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {[
              ["1", "Install & record", "Add the Recio extension, hit record, pick your screen."],
              ["2", "Auto-saved to your cloud", "Stop and it uploads to your own Drive, Dropbox, or Recio storage."],
              ["3", "Share the link", "Send the link. Viewers watch, react, and comment — no account needed."],
            ].map(([n, t, d]) => (
              <div key={n} className="text-center">
                <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#0b1220] font-display text-lg font-semibold text-white">
                  {n}
                </span>
                <h3 className="mt-4 text-base font-semibold text-[#0b1220]">{t}</h3>
                <p className="mt-1.5 text-sm text-slate-600">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="storage" className="mx-auto max-w-4xl px-6 py-24 text-center">
        <h2 className="font-display text-4xl font-semibold text-[#0b1220]">Ready when you are.</h2>
        <p className="mx-auto mt-3 max-w-md text-slate-600">
          Free to start. Your recordings, in your cloud, forever.
        </p>
        <Link
          to={authed ? "/dashboard" : "/register"}
          className="mt-7 inline-block rounded-full bg-[#0b1220] px-7 py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.03]"
        >
          {authed ? "Open Recio" : "Create your free account"}
        </Link>
      </section>

      <footer className="border-t border-slate-200 py-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 text-sm text-slate-500">
          <span className="flex items-center gap-2">
            <Logo width={20} height={20} /> Recio
          </span>
          <span className="font-mono text-xs">Your storage, your control.</span>
        </div>
      </footer>
    </div>
  );
}

function FloatCard({
  title,
  views,
  hue,
  className,
  featured,
}: {
  title: string;
  views: number;
  hue: string;
  className?: string;
  featured?: boolean;
}) {
  return (
    <div
      className={`w-64 shrink-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl shadow-slate-900/5 ${className ?? ""}`}
    >
      <div
        className="flex aspect-video items-center justify-center rounded-xl"
        style={{ background: `linear-gradient(135deg, ${hue}22, ${hue}10)` }}
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/80 shadow" style={{ color: hue }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7 5v14l12-7z" />
          </svg>
        </span>
      </div>
      <p className="mt-2.5 truncate text-sm font-medium text-[#0b1220]">{title}</p>
      <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
        <span className="font-mono">{views} views</span>
        <span>{featured ? "❤️ 🔥 👏" : "👍 ❤️"}</span>
      </div>
    </div>
  );
}
