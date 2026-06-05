# Recio API server (Node + Express + Prisma). Build context = repo root.
#   docker build -t recio-server .
#   docker run -p 4000:4000 --env-file .env recio-server
FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# Install deps for the shared + server packages.
COPY pnpm-workspace.yaml package.json .npmrc tsconfig.base.json ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
RUN pnpm install --no-frozen-lockfile

# Build shared, generate the Prisma client, build the server bundle.
COPY shared ./shared
COPY server ./server
RUN pnpm --filter @flowcap/shared build \
 && pnpm --filter @flowcap/server exec prisma generate \
 && pnpm --filter @flowcap/server build

EXPOSE 4000
# Apply pending migrations, then start. All secrets come from the runtime env.
CMD ["sh", "-c", "pnpm --filter @flowcap/server exec prisma migrate deploy && node server/dist/index.js"]
