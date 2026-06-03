/** Marketing landing page with the extension-install CTA. */
import { Link } from "react-router-dom";
import { ImageIcon, LinkIcon, Logo, VideoIcon } from "../components/icons.js";
import { Button } from "../components/ui.js";

const FEATURES = [
  {
    Icon: VideoIcon,
    title: "Record anything",
    body: "Full screen, a window, or a tab — with mic and system audio. Pause and resume on the fly.",
  },
  {
    Icon: ImageIcon,
    title: "Your storage, not ours",
    body: "Recordings land straight in your own Google Drive. No storage fees, no lock-in, no caps.",
  },
  {
    Icon: LinkIcon,
    title: "Share in one click",
    body: "Every capture gets a shareable link. Flip it public or private anytime — applied instantly.",
  },
];

export function Landing() {
  return (
    <div className="min-h-full">
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2 text-text-primary">
          <Logo className="text-accent" />
          <span className="text-[15px] font-semibold tracking-tight">FlowCap</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login" className="text-sm text-muted hover:text-text-primary">
            Sign in
          </Link>
          <Link to="/register">
            <Button size="sm">Get started</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="dot-grid relative overflow-hidden border-y border-border">
        <div className="mx-auto max-w-3xl px-6 py-24 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 font-mono text-[11px] text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-success" /> Your storage. Your control.
          </span>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl">
            Screen recording that saves to <span className="text-accent">your own cloud</span>.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-muted">
            FlowCap is a Loom alternative where your recordings live in your Google Drive — not behind
            someone else's paywall. Record, share a link, done.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <a href="https://chrome.google.com/webstore" target="_blank" rel="noreferrer">
              <Button size="md">Add to Chrome</Button>
            </a>
            <Link to="/register">
              <Button variant="secondary" size="md">
                Create an account
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <div className="grid gap-6 sm:grid-cols-3">
          {FEATURES.map(({ Icon, title, body }) => (
            <div key={title} className="rounded-lg border border-border bg-card p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent/10 text-accent">
                <Icon width={18} height={18} />
              </div>
              <h3 className="mt-4 text-sm font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm text-muted">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border px-6 py-8 text-center font-mono text-[11px] text-muted">
        FlowCap · your storage, your control
      </footer>
    </div>
  );
}
