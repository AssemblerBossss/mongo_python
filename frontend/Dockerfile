FROM node:22-slim AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
COPY scripts ./scripts
RUN npm ci

COPY . .

# next.config.mjs's rewrites() reads this at `next build` time and bakes the
# result into the standalone build — it won't re-read it from the container's
# runtime environment, so it must also be set here, not only in compose.
ARG BACKEND_API_ORIGIN=http://backend:8000
ENV BACKEND_API_ORIGIN=$BACKEND_API_ORIGIN

RUN npm run build

FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]
