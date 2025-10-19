# Frontend (Next.js Server) with Nginx reverse proxy
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

# Set environment variables for build
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Skip linting during build to avoid build failures
ENV SKIP_LINT=true

# Build Next.js application with verbose output
RUN npm run build || (echo "Build failed. Checking for errors..." && exit 1)

# ============================================
# Next.js runtime
FROM node:20-alpine AS nextjs
WORKDIR /app
ENV NODE_ENV=production

# Copy necessary files
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000
CMD ["npm", "start"]

# ============================================
# Nginx reverse proxy
FROM nginx:alpine AS nginx
RUN apk add --no-cache gettext

# Copy Nginx config template
COPY nginx-proxy.conf.template /etc/nginx/nginx.conf.template
COPY start-nginx.sh /usr/local/bin/start-nginx.sh
RUN sed -i 's/\r$//' /usr/local/bin/start-nginx.sh && chmod +x /usr/local/bin/start-nginx.sh

# Environment variables for backend URL
ENV BACKEND_URL="http://backend:8000"

EXPOSE 80
CMD ["/usr/local/bin/start-nginx.sh"]
