# Recio

**Screen recording that lives in your own cloud.** Record your screen and webcam in
the browser, drop comments, share a link — and keep every recording in **your own
Google Drive, Dropbox, or Recio cloud**. Recio stores only metadata + share state.
A Loom alternative built on the premise that your media is yours.

> Rebuild of the original no-backend `MyLoom` extension into a full TypeScript monorepo
> (extension + web + server + shared) with accounts, a media library, reactions, comments,
> and server-controlled sharing.

## Monorepo layout

| Package      | What it is                                                            |
| ------------ | --------------------------------------------------------------------- |
| `shared/`    | TypeScript types, enums, error codes, Zod schemas, design tokens      |
| `server/`    | Node + Express + Prisma (PostgreSQL) API — auth, storage, sharing     |
| `web/`       | React + Vite SPA — landing, dashboard, media library, share controls  |
| `extension/` | Chrome MV3 extension (TS + React) — recording, screenshots, uploads   |

Tooling: **pnpm workspaces** + **Turborepo**. TypeScript strict everywhere.
(Internal package names remain `@flowcap/*`; the product brand is **Recio**.)

## Prerequisites

- Node ≥ 20 and pnpm 9 (`npx pnpm@9 …` works without a global install)
- Docker (for local PostgreSQL)
- A Google Cloud OAuth client — see [Google setup](#google-oauth-setup)
- A Supabase project with a Storage bucket — see [Supabase setup](#supabase-storage-setup)
- (Optional) A Dropbox app — see [Dropbox setup](#dropbox-setup)

## Quick start

```bash
cp .env.example .env          # then fill in secrets (see below)
pnpm install
pnpm db:up                    # PostgreSQL via docker compose
pnpm --filter @flowcap/server db:migrate   # apply Prisma schema
pnpm dev                      # turbo runs server + web + extension build
```

Load the extension: `chrome://extensions` → Developer mode → **Load unpacked** →
`extension/dist`.

## Secrets you must generate

```bash
openssl rand -hex 32   # → JWT_ACCESS_SECRET
openssl rand -hex 32   # → JWT_REFRESH_SECRET
openssl rand -hex 32   # → TOKEN_ENCRYPTION_KEY  (must be 32 bytes / 64 hex chars)
```

## Google OAuth setup

1. Google Cloud Console → **APIs & Services → Enable APIs** → enable **Google Drive API**.
2. **OAuth consent screen**: External; scopes `drive.file`, `userinfo.email`,
   `userinfo.profile`; add yourself under **Test users**.
3. **Credentials → OAuth client ID → Web application**: redirect URIs
   `http://localhost:4000/storage/drive/callback` and `https://<ext-id>.chromiumapp.org/`
   (the extension's `chrome.identity.getRedirectURL()`). Put the id/secret in `.env` and
   `VITE_GOOGLE_CLIENT_ID` in `web/.env` + `extension/.env`.

## Dropbox setup

Optional third storage provider. [dropbox.com/developers](https://www.dropbox.com/developers)
→ **Create app** (Scoped access, full Dropbox) → enable `files.content.write`,
`files.content.read`, `sharing.write`, `account_info.read`. Add redirect URIs
`http://localhost:4000/storage/dropbox/callback` and `https://<ext-id>.chromiumapp.org/`.
Put the app key/secret in `.env` (`DROPBOX_CLIENT_ID/SECRET`) and the key in
`extension/.env` (`VITE_DROPBOX_CLIENT_ID`).

## Supabase Storage setup

The "Save to Recio" path stores media in Supabase Storage (signed upload URLs; bytes go
client → Supabase directly).

1. Create a project at [supabase.com](https://supabase.com).
2. **Storage → New bucket** named `recio-media`, **Private**.
3. **Settings → API**: `SUPABASE_URL` = Project URL; `SUPABASE_SERVICE_ROLE_KEY` = the
   **secret** key (`sb_secret_…` or legacy `service_role` JWT — **not** the publishable/anon key).

## Deployment

Three deployable units. Inject env vars from your host (don't ship `.env`).

**Server (API)** — Dockerized; build context is the repo root:

```bash
docker build -t recio-server .
docker run -p 4000:4000 --env-file .env recio-server   # runs `prisma migrate deploy` then starts
```

Set production env: `WEB_ORIGIN=https://recio.app`, `DATABASE_URL`, the JWT + token-encryption
secrets, Google/Dropbox/Supabase creds, and the `*_OAUTH_REDIRECT_URI`s pointing at your API
host. Works on any container host (Render, Railway, Fly.io, etc.). For a managed Postgres,
the container applies pending migrations on boot.

**Web (SPA)** — static build, deploy to Vercel/Netlify/any static host:

```bash
pnpm --filter @flowcap/shared build && pnpm --filter @flowcap/web build   # → web/dist
```

SPA routing is handled by `web/vercel.json` (rewrites) and `web/public/_redirects`
(Netlify). Set build-time env: `VITE_API_BASE_URL=https://api.recio.app` and
`VITE_GOOGLE_CLIENT_ID`. Add a real `web/public/og.png` (1200×630) for social previews —
the meta tags reference `/og.png`.

**Extension** — `pnpm --filter @flowcap/extension build` → `extension/dist`. Set
`VITE_API_BASE_URL`, `VITE_WEB_BASE_URL`, `VITE_GOOGLE_CLIENT_ID`, `VITE_DROPBOX_CLIENT_ID`
in `extension/.env`, then zip `extension/dist` for the Chrome Web Store. Add the published
extension's `chromiumapp.org` redirect to your OAuth clients.

## Features

Screen + webcam recording (all surfaces, on-page camera bubble, mic, pause/resume,
countdown, quality presets, device pickers) · region & full screenshots · **bring-your-own
storage** (Google Drive / Dropbox / Recio-Supabase) · auto-upload → share link · server-side
Drive permission toggle · dashboard (filter/sort/search, grid/list) · detail pages with inline
rename + delete · **reactions** + **time-stamped comments** (persisted) · email + Google auth.

**Not built yet**: link embed/password/expiry · trim · folders · thumbnails · AI transcript/summary
· team workspaces.

See `.claude/plans/zesty-growing-chipmunk.md` for the architecture decision document.
