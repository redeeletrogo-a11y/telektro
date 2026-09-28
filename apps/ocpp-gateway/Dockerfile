FROM node:24-alpine

RUN corepack enable && corepack prepare pnpm@11.19.0 --activate
WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/ocpp-gateway/package.json apps/ocpp-gateway/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --filter @telektro/ocpp-gateway --frozen-lockfile

COPY apps/ocpp-gateway apps/ocpp-gateway
RUN pnpm --filter @telektro/ocpp-gateway build

ENV NODE_ENV=production
EXPOSE 9000
CMD ["node", "apps/ocpp-gateway/dist/index.js"]
