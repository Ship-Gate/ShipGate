FROM node:20-slim AS base

WORKDIR /app

ENV NODE_ENV=production

COPY dist/ ./dist/
COPY package.json ./
COPY node_modules/ ./node_modules/

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "fetch('http://localhost:4000/api/v1/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "dist/index.js"]
