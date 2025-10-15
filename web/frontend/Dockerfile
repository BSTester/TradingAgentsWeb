# Frontend (Next.js static export) served by Nginx
# ============================================
# deps stage
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# ============================================
# build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
# Build and static export to /app/out
RUN npm run build

# ============================================
# nginx runtime (pure static)
FROM nginx:alpine AS runner
# Install gettext for envsubst
RUN apk add --no-cache gettext
# Copy static site
COPY --from=builder /app/out /usr/share/nginx/html
# Nginx config template and startup script
COPY nginx.conf.template /etc/nginx/nginx.conf.template
COPY start.sh /usr/local/bin/start.sh
RUN sed -i 's/\r$//' /usr/local/bin/start.sh && chmod +x /usr/local/bin/start.sh
# API backend base URL (e.g., http://backend:8000)
ENV FRONTEND_API_BASE_URL="http://localhost:8000"
EXPOSE 80
CMD ["/usr/local/bin/start.sh"]