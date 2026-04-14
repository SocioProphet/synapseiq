FROM node:20-slim AS build
WORKDIR /app
COPY . .
RUN corepack enable && corepack prepare pnpm@10.6.0 --activate
RUN pnpm install --no-frozen-lockfile
RUN pnpm --filter @socioprophet/synapseiq-tabular-alpha-api build

FROM node:20-slim AS runtime
WORKDIR /app
COPY --from=build /app/services/tabular-alpha-api/dist ./dist
COPY --from=build /app/services/tabular-alpha-api/package.json ./package.json
ENV PORT=8080
EXPOSE 8080
CMD ["node", "dist/services/tabular-alpha-api/src/server.js"]
