#!/bin/sh
set -e

# Remove http:// or https:// prefix from BACKEND_URL for upstream
BACKEND_HOST=$(echo "${BACKEND_URL}" | sed 's|^https\?://||')

# Replace environment variables in nginx config
export BACKEND_HOST
envsubst '${BACKEND_HOST}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

# Start nginx
echo "Starting Nginx reverse proxy..."
echo "Backend URL: ${BACKEND_URL}"
echo "Backend Host: ${BACKEND_HOST}"
nginx -g 'daemon off;'
