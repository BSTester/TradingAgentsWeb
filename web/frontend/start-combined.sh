#!/bin/sh
set -e

echo "Starting TradingAgents Frontend (Next.js + Nginx)..."
echo "Backend URL: ${BACKEND_URL}"

# Replace environment variables in nginx config
envsubst '${BACKEND_URL}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

# Start supervisor (manages both Next.js and Nginx)
exec /usr/bin/supervisord -c /etc/supervisord.conf
