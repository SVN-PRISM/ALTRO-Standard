# ALTRO STENCIL — Next.js standalone (Ollama снаружи: OLLAMA_BASE_URL).
# Сборка: docker build -t altro-stencil .
# Запуск: docker run -p 3002:3002 -e OLLAMA_BASE_URL=http://host.docker.internal:11434 altro-stencil
#
# Важно: в runner обязательно копируются public + standalone + .next/static —
# без .next/static не отдаются чанки и CSS/Tailwind из /_next/static/*.

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3002
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# 1) Статические файлы приложения (favicon и т.д.)
COPY --from=builder /app/public ./public

# 2) Standalone: server.js, node_modules (traced), .next/server — без клиентских чанков/CSS
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# 3) Клиентские ассеты: chunks, CSS (Tailwind), media — путь должен быть ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# public мог остаться root:root; для чтения nextjs достаточно o+r, но выравниваем владельца
RUN chown -R nextjs:nodejs /app/public

USER nextjs

EXPOSE 3002

CMD ["node", "server.js"]
