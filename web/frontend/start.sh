#!/bin/sh
set -e

# Render nginx config from template using environment variables
if [ -z "$FRONTEND_API_BASE_URL" ]; then
  echo "FRONTEND_API_BASE_URL not set, defaulting to http://localhost:8000"
  export FRONTEND_API_BASE_URL="http://localhost:8000"
fi

envsubst '\$FRONTEND_API_BASE_URL' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

# Start Nginx in foreground
echo "Starting Nginx (static site + /api proxy to $FRONTEND_API_BASE_URL)..."
exec nginx -g 'daemon off;'