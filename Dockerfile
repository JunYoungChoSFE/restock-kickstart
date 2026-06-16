FROM node:20-alpine
RUN apk add --no-cache openssl

EXPOSE 3000

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json* ./

RUN npm ci && npm cache clean --force

COPY . .

# Production keeps SQLite on the persistent Fly volume (/data); Litestream replicates it to object storage.
# Only the in-image schema path is changed — the on-disk schema (local dev) stays file:dev.sqlite.
RUN sed -i 's#url *= *"file:dev.sqlite"#url = "file:/data/dev.sqlite"#' prisma/schema.prisma

RUN npx prisma generate

RUN npm run build

CMD ["npm", "run", "docker-start"]
