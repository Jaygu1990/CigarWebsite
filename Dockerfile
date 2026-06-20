FROM node:22-alpine
WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# Persist the SQLite DB on a mounted volume (e.g. Fly.io / Render disk at /data)
ENV DB_PATH=/data/cigars.db
ENV PORT=8099
EXPOSE 8099

CMD ["node", "--experimental-sqlite", "server.js"]
