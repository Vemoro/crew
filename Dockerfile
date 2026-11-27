FROM oven/bun:1.4.5 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY vite.config.ts tsconfig.json ./
COPY src/ ./src/
COPY public/ ./public/
RUN bun run build

FROM oven/bun:1.4.5-slim
WORKDIR /app
COPY --chown=bun:bun package.json bun.lock LICENSE ./
RUN bun install --production --frozen-lockfile
COPY --from=build --chown=bun:bun /app/.output/ ./.output/
COPY --chown=bun:bun src/cli/ ./src/cli/
COPY --chown=bun:bun src/server/ ./src/server/
USER bun
ENV PORT=8080 HOST=0.0.0.0 TZ=Europe/Berlin
EXPOSE 8080
CMD ["sh", "-c", "bun run migrate && exec bun .output/server/index.mjs"]
