# PRISMATIC project runtime.
#
# One image runs every generated project. The toolchain and the whitelist of packages a
# project may import are baked in here, so containers never need network access to build
# and projects cannot install arbitrary packages.
FROM node:22-alpine

RUN apk add --no-cache tini coreutils \
 && mkdir -p /opt/prismatic /workspace /srv/prismatic/site \
 && chown -R node:node /workspace /srv/prismatic

WORKDIR /opt/prismatic
COPY package.json package-lock.json ./
# Locked versions; optional native binaries (rollup, tailwind oxide) are required by the build.
RUN npm ci --no-audit --no-fund && npm cache clean --force
COPY build.mjs serve.mjs tsconfig.base.json ./
COPY placeholder/ /srv/prismatic/site/
RUN chown -R node:node /srv/prismatic

# Workspace resolves packages from the baked-in toolchain.
RUN ln -s /opt/prismatic/node_modules /workspace/node_modules && chown -h node:node /workspace/node_modules

USER node
ENV NODE_ENV=production PORT=3000 SITE_DIR=/srv/prismatic/site
EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "/opt/prismatic/serve.mjs"]
