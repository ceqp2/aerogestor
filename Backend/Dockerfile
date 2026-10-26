# AEROGEST GSD — API
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npx nest build && npm prune --omit=dev && npx prisma generate

FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl tini && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /app/storage && chown -R node:node /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --chown=node:node package.json ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/usr/bin/tini", "--"]
# Aplica migrations, garante dados-base idempotentes (unidade, parâmetros propostos, modelos) e inicia a API
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/cli/seed.js && if [ -n \"$ADMIN_EMAIL\" ] && [ -n \"$ADMIN_NOME\" ]; then node dist/cli/create-admin.js --email \"$ADMIN_EMAIL\" --nome \"$ADMIN_NOME\" --unidade \"${ADMIN_UNIDADE:-GSD-SJ}\"; fi && node dist/main.js"]
