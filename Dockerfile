# Build the complete workspace once, then run the selected process from the
# immutable build tree. Provider credentials are injected only at runtime.
FROM node:24.4.1-bookworm-slim AS build

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig*.json .prettier* eslint.config.mjs ./
COPY apps ./apps
COPY packages ./packages
COPY tests ./tests
COPY scripts ./scripts
RUN corepack enable && corepack pnpm install --frozen-lockfile && corepack pnpm build

FROM node:24.4.1-bookworm-slim AS runtime-base

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8080
WORKDIR /app
COPY --from=build /app /app
RUN chown -R node:node /app

FROM runtime-base AS runtime
USER node

ARG SERVICE=api
ENV SERVICE=${SERVICE}
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 8080) + '/health/live').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"
CMD ["sh", "-c", "case \"$SERVICE\" in api) corepack pnpm --filter @family-historian/api start ;; worker) corepack pnpm --filter @family-historian/worker start ;; web) corepack pnpm --filter @family-historian/web start ;; *) echo \"unknown SERVICE=$SERVICE\" >&2; exit 64 ;; esac"]

# The media worker is isolated from API/web images and carries only the pinned
# native tools required by the no-shell media executor. The worker process still
# fails closed when a tool is unavailable or a plan exceeds its resource bounds.
FROM runtime-base AS worker-runtime

RUN apt-get update \
  && apt-get install --no-install-recommends --yes \
    clamav \
    exiftool \
    ffmpeg \
    imagemagick \
    ocrmypdf \
    python3 \
  && if ! command -v magick >/dev/null 2>&1; then ln -s "$(command -v convert)" /usr/local/bin/magick; fi \
  && rm -rf /var/lib/apt/lists/*

ENV SERVICE=worker
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 8080) + '/health/live').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"
CMD ["corepack", "pnpm", "--filter", "@family-historian/worker", "start"]
