#!/usr/bin/env bash
set -euo pipefail

# Substitute env vars into nginx template
# If SSL_CERT is set → render HTTP+HTTPS template; otherwise HTTP-only template
if [ -n "${SSL_CERT:-}" ]; then
  TMPL=/etc/nginx/templates/default.conf.template
  echo "[entrypoint] SSL detected — rendering HTTP+HTTPS config" >&2
else
  TMPL=/etc/nginx/templates/http.conf.template
  echo "[entrypoint] No SSL — rendering HTTP-only config" >&2
fi
echo "  BACKEND_URL=${BACKEND_URL}" >&2
echo "  WS_WORKER_HOST=${WS_WORKER_HOST:-<not set>}" >&2
envsubst '$BACKEND_URL $WS_WORKER_HOST $SSL_CERT $SSL_KEY' \
  < "$TMPL" \
  > /etc/nginx/conf.d/default.conf

# Show final config for debugging (optional; comment out in sensitive envs)
cat /etc/nginx/conf.d/default.conf >&2 || true

exec nginx -g 'daemon off;'
