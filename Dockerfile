# PRISMATIC application image (Next.js standalone).
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund

FROM node:22-alpine AS build
WORKDIR /app
# Public, build-time values (inlined into the browser bundle by Next.js). Never pass secrets here.
ARG NEXT_PUBLIC_PRIVY_APP_ID
ARG NEXT_PUBLIC_ROBINHOOD_RPC_URL
ARG NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
ENV NEXT_PUBLIC_PRIVY_APP_ID=$NEXT_PUBLIC_PRIVY_APP_ID     NEXT_PUBLIC_ROBINHOOD_RPC_URL=$NEXT_PUBLIC_ROBINHOOD_RPC_URL     NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=$NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Placeholders only for the build step; real values are injected at runtime.
ENV NEXT_TELEMETRY_DISABLED=1 AUTH_SECRET=build-placeholder DATABASE_URL=postgresql://build:build@localhost:5432/build
RUN npx prisma generate && npm run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S prismatic && adduser -S prismatic -G prismatic && mkdir -p /data && chown prismatic:prismatic /data \
 && npm install -g prisma@6.19.3 --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/contracts ./contracts
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
USER prismatic
EXPOSE 3000
CMD ["sh", "-c", "prisma migrate deploy && node server.js"]
