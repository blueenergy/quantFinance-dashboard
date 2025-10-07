#!/usr/bin/env bash
set -euo pipefail

# Substitute env vars into nginx template
if [ -f /etc/nginx/templates/default.conf.template ]; then
  echo "[entrypoint] Rendering nginx config with BACKEND_URL=${BACKEND_URL}" >&2
  envsubst '$BACKEND_URL' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf
fi

# Show final config for debugging (optional; comment out in sensitive envs)
cat /etc/nginx/conf.d/default.conf >&2 || true

exec nginx -g 'daemon off;'
