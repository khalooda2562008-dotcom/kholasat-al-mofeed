FROM node:22-bookworm-slim

ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app

# better-sqlite3 may compile its native binding when a prebuilt binary is unavailable.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run check && npm test && npm run build && npm prune --omit=dev \
  && mkdir -p /app/data \
  && chown -R node:node /app

USER node
EXPOSE 3000
VOLUME ["/app/data"]
CMD ["npm", "start"]
