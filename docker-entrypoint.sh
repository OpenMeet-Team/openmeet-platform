#!/bin/sh
set -e

# Substitute environment variables in nginx config template
# This allows us to use ${BACKEND_DOMAIN}, ${QUASAR_DEV_HOST}, and ${TENANT_ID} in the nginx.conf

# Required: APP_TENANT_ID must be set (platform convention)
if [ -z "$APP_TENANT_ID" ]; then
  echo "ERROR: APP_TENANT_ID environment variable is required but not set"
  echo "Please set APP_TENANT_ID in your platform config"
  exit 1
fi

# Map APP_TENANT_ID to TENANT_ID for nginx template
export TENANT_ID="$APP_TENANT_ID"

# Default values for optional vars
export BACKEND_DOMAIN=${BACKEND_DOMAIN:-http://api}
export QUASAR_DEV_HOST=${QUASAR_DEV_HOST:-platform-dev:9005}

echo "Starting nginx with:"
echo "  BACKEND_DOMAIN: ${BACKEND_DOMAIN}"
echo "  QUASAR_DEV_HOST: ${QUASAR_DEV_HOST}"
echo "  TENANT_ID: ${TENANT_ID}"

# Note: nginx:alpine automatically processes /etc/nginx/templates/*.template
# and outputs to /etc/nginx/conf.d/ with environment variable substitution.

# Process templates manually since we're replacing the default entrypoint
# Production uses: BACKEND_DOMAIN, TENANT_ID
# Dev also uses: QUASAR_DEV_HOST
if [ -n "$QUASAR_DEV_HOST" ]; then
  envsubst '${BACKEND_DOMAIN} ${TENANT_ID} ${QUASAR_DEV_HOST}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf
else
  envsubst '${BACKEND_DOMAIN} ${TENANT_ID}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf
fi

# Start nginx in foreground
exec nginx -g 'daemon off;'
