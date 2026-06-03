# FlowCap

SaaS screen recording where **users own their storage**. Record your screen or grab a
screenshot in the browser and save it straight to **your own Google Drive** (or FlowCap's
own storage, backed by Supabase Storage) — FlowCap keeps only metadata and share state. A
Loom alternative built on the premise that your media is yours.

> Rebuild of the original no-backend `MyLoom` extension into a full TypeScript monorepo
> (extension + web + server + shared) with accounts, a media library, and server-controlled
> sharing.

## Monorepo layout

| Package      | What it is                                                            |
| ------------ | --------------------------------------------------------------------- |
| `shared/`    | TypeScript types, enums, error codes, Zod schemas, design tokens      |
| `server/`    | Node + Express + Prisma (PostgreSQL) API — auth, storage, sharing     |
| `web/`       | React + Vite SPA — dashboard, media library, share controls           |
| `extension/` | Chrome MV3 extension (TS + React) — recording, screenshots, uploads   |

Tooling: **pnpm workspaces** + **Turborepo**. TypeScript strict everywhere.

## Prerequisites

- Node ≥ 20 and pnpm 9 (`npx pnpm@9 …` works without a global install)
- Docker (for local PostgreSQL)
- A Google Cloud OAuth client — see [Google setup](#google-oauth-setup)
- A Supabase project with a Storage bucket (for the "Save to FlowCap" path) — see [Supabase setup](#supabase-storage-setup)

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

The Drive features need a Google Cloud OAuth client. In the Google Cloud Console:

1. Create a project → **APIs & Services → Enable APIs** → enable **Google Drive API**.
2. **OAuth consent screen**: External, add scopes `drive.file`, `userinfo.email`,
   `userinfo.profile`. Add yourself as a test user.
3. **Credentials → Create OAuth client ID → Web application**: add redirect URI
   `http://localhost:4000/storage/drive/callback`. Put the client id/secret into `.env`.
4. **Credentials → Create OAuth client ID → Chrome Extension**: tie it to the unpacked
   extension's ID (shown in `chrome://extensions`). Put that client id into the extension config.

Until these exist the app builds and runs, but the Drive connect / upload path won't work.

## Supabase Storage setup

The "Save to FlowCap" path stores media in Supabase Storage (the server mints short-lived
signed upload URLs; bytes go client → Supabase directly, never through our backend).

1. Create a project at [supabase.com](https://supabase.com).
2. **Storage → New bucket**: name it `flowcap-media`, keep it **Private** (downloads use
   time-limited signed URLs).
3. **Settings → API**: copy the **Project URL** → `SUPABASE_URL`, and the **service_role**
   key → `SUPABASE_SERVICE_ROLE_KEY` in `.env`. The service-role key is secret and only ever
   used server-side.

Until these exist the app builds and runs, but the "Save to FlowCap" path won't work.

## Scope

**MVP**: TS MV3 extension · full-screen/window/tab recording · screenshots + region select ·
save to Drive **or** FlowCap · email/password + Google auth · dashboard with storage badges ·
shareable links with server-side Drive permission control · detail views.

**Phase 2 (not built yet)**: webcam overlay · in-recording annotations · comments · Dropbox ·
team workspaces · trimming · transcripts · mobile · transcoding.

See `.claude/plans/zesty-growing-chipmunk.md` for the full architecture decision document.
