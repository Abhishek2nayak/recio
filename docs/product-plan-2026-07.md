# Vyooom — Product Power-Up Plan

**Date:** July 9, 2026 · Companion to [audit-2026-07.md](./audit-2026-07.md).
This is the "what should we build to make the product more powerful" list, organized so you can pull work in priority order without destabilizing the foundation.

**The north star:** *"The Loom that saves to your own Google Drive."* Every feature below is judged against whether it (a) makes that promise more real, (b) removes friction from record → share → watch, or (c) converts free users to paid. Features that don't serve one of those are parked.

---

## Tier 0 — Foundation (do these before any new shiny feature)

These are from the audit's Critical list. New features on an unstable base just add surface area to break. Short version:

- **Crash-safe recording** — stream chunks to IndexedDB as they arrive + recover on restart; add a duration cap. (Today a crash mid-recording loses everything.)
- **iOS/Safari-playable output** — mp4-first capture where supported + a transcode fallback, or the share link is dead for a big share of recipients.
- **Error monitoring + a job queue** — Sentry across all three runtimes; move transcription/transcode/janitor work off the request path.
- **Onboarding that can't dead-end** — the destination pre-flight (just shipped) plus a guided first recording.

Everything below assumes Tier 0 is in flight.

---

## Tier 1 — Sharpen the core loop (highest ROI features)

### 1. A real editor timeline
Today: non-destructive trim, smart-cleanup cuts, and overlays exist but are edited through separate controls. Loom's retention hook is that you can *fix a recording without re-recording*.
- **Trim handles on a visual timeline** (waveform + thumbnails) instead of numeric inputs.
- **Cut a middle section** (not just head/tail trim) — you already store `cuts` as skip-ranges; expose manual cut creation, not just AI cleanup.
- **Re-record a segment** — the single most-requested Loom editing feature. Record a replacement clip for a selected range; stitch via the transcode job.
- **Auto-chapters** from the transcript word timestamps (you already have them) — cheap, high-perceived-value.

### 2. Viewer-side engagement (drives the "why come back" loop)
- **Notifications** when someone views or comments (email + extension badge). Without this there's no reason to return to the dashboard — this is the #1 retention gap.
- **Per-viewer analytics** — you already store `ViewEvent.watchedPct`; surface "who watched, how far, where they dropped." This is a genuine differentiator vs. Loom's free tier.
- **Reactions/comments at a timestamp** already exist — add **email digest** of new activity.

### 3. Make "your storage" tangible and trustworthy
This is the wedge — lean into it.
- **Prominent Download button** everywhere (share page + library). The bytes are theirs; make it obvious.
- **"Where is this file?" affordance** — a link that opens the file in their actual Drive/Dropbox folder.
- **Storage dashboard** — show Drive quota (API already wired via `getStorageQuota`, currently unused), used space, and a pre-record low-space warning.
- **A plain-language trust page**: "we store metadata + an encrypted token, never your video." Non-negotiable for a Drive-scope extension.

---

## Tier 2 — Competitive parity + polish

### 4. Capture quality (this is where Screen Studio wins)
- **Auto-zoom / cursor spotlight** — smoothly zoom toward clicks/activity in post. High wow-factor, pure client-side canvas work, no new backend.
- **Cursor smoothing + click ripples** as a post effect.
- **Backgrounds/padding** — frame the recording in a colored/gradient backdrop (creator-grade look, à la Tella).
- **Camera layouts** — switch bubble ↔ side-by-side ↔ full-screen mid-recording. You already composite the camera; this is layout state on top.

### 5. Whiteboard canvas (just rebuilt in-house — extend it)
Now that it's our own canvas (`WhiteboardCanvas.tsx`), we can grow it cheaply:
- Sticky notes, image paste, straight-line snapping, select/move/resize existing shapes (v1 has draw + eraser but no re-select).
- Infinite/pannable canvas + zoom.
- Save the board as an image/PDF alongside the recording.
- Persist board state so a whiteboard is reopenable, not just recordable.

### 6. Screenshot tool depth
- **Annotate screenshots** (arrows/text/blur/numbered steps) — reuse the whiteboard canvas engine.
- **Scrolling screenshot** (full-page capture beyond the viewport).
- **Step-by-step guide generation** (Guidde's niche) — auto-capture on each click, assemble a doc. Big future bet.

### 7. Sharing surface
- **Proper Slack app** (not webhook paste) + Notion/Linear/GitHub embeds.
- **Custom share domains** (Business) and branded share pages (branding exists — extend).
- **Embed code + "copy at timestamp."**
- **Password/expiry links** exist — add **email-gated** links (capture who's watching) for sales use-cases.

---

## Tier 3 — Differentiators & expansion

### 8. Storage ownership, expanded (the moat)
- **OneDrive + S3-compatible** (S3/R2/B2/MinIO/Wasabi) — this is Cap's home turf; add when a customer asks, but it's the natural extension of the promise.
- **Local-only mode** — record straight to disk / a local folder, never create a server row. Ultimate privacy story; strong for compliance buyers.
- **Data-residency / compliance page** (GDPR, DPA, SOC2 roadmap) — unlocks B2B deals Loom's "our servers" model can't.

### 9. AI depth (you have the pipeline; monetize it)
- **AI clips** — "turn this 20-min recording into a 60-sec highlight" from the transcript.
- **Chapters, action items, and a shareable summary doc** auto-generated (summary + title already exist).
- **Ask-this-video** Q&A over the transcript.
- **Translated dubbing** (you already do translated captions — dubbing is the premium step).
- Keep it all **metered** against plan minutes (infra already there).

### 10. Team & platform
- **Workspaces exist** — add SSO/SCIM, roles, shared brand kits, team analytics dashboards (Business tier).
- **Public API + Zapier/Make** — recordings as a workflow primitive.
- **Desktop app (Tauri/Electron)** — system-wide capture, reliable system audio on macOS, off-Chrome reliability. The biggest capability unlock, but a large lift — sequence it late.

---

## What NOT to build (avoid scope creep)

- A full video editor (multi-track, transitions) — you're a *communication* tool, not Premiere. Re-record + trim + cuts is the right ceiling.
- Live streaming / webinars — different product, different infra.
- A social/discovery feed — recordings are private-by-purpose; don't dilute the trust story.
- More storage providers *before* the core loop is flawless — breadth doesn't matter if the first recording can be lost.

---

## Suggested sequencing (quarters, rough)

| Horizon | Theme | Headline items |
| --- | --- | --- |
| **Now** | Foundation | Crash-safe recording, iOS playback, monitoring, job queue, onboarding |
| **Next** | Core loop | Editor timeline + re-record, view/comment notifications, download + storage dashboard |
| **Then** | Parity + polish | Auto-zoom/cursor effects, whiteboard v2, screenshot annotation, Slack app |
| **Later** | Differentiate | S3/OneDrive/local-only, AI clips + chapters, compliance page |
| **Bet** | Platform | Desktop app, public API, team/SSO |

The theme: **make the free loop unbreakable and delightful first** (Tier 0–1), then **out-polish Loom on capture and out-trust it on storage** (Tier 2–3). Don't invert that order.
