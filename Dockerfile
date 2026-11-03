# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Dependencies: install everything, including the native build toolchain that
# argon2 and bcrypt need on Alpine.
# ---------------------------------------------------------------------------
FROM node:24-alpine AS deps

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------------------
# Build: compile the NestJS application and drop dev dependencies.
# ---------------------------------------------------------------------------
FROM deps AS build

WORKDIR /app

COPY . .
RUN npm run build \
    && npm prune --omit=dev

# ---------------------------------------------------------------------------
# Runtime: small image with only the compiled app and production dependencies.
# ---------------------------------------------------------------------------
FROM node:24-alpine AS runtime

ENV NODE_ENV=production \
    PORT=3000

WORKDIR /app

RUN apk add --no-cache libstdc++ tini

COPY --from=build --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist

USER node

EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
