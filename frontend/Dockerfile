# Image glibc : le lockfile versionne le binaire SWC linux-x64-gnu de Next.
FROM node:20-bookworm-slim

ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . ./
RUN npm run build

EXPOSE 3001

CMD ["npm", "start", "--", "-p", "3001"]
