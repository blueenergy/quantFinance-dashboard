#!/usr/bin/env bash
set -euo pipefail

# Substitute env vars into nginx template.
# Enable HTTPS only when both certificate paths are set and mounted files exist.
if [ -n "${SSL_CERT:-}" ] && [ -n "${SSL_KEY:-}" ] && [ -f "$SSL_CERT" ] && [ -f "$SSL_KEY" ]; then
  TMPL=/etc/nginx/templates/default.conf.template
  echo "[entrypoint] SSL detected — rendering HTTP+HTTPS config" >&2
else
  TMPL=/etc/nginx/templates/http.conf.template
  if [ -n "${SSL_CERT:-}" ] || [ -n "${SSL_KEY:-}" ]; then
    echo "[entrypoint] SSL env is incomplete or files are missing — rendering HTTP-only config" >&2
    echo "  SSL_CERT=${SSL_CERT:-<not set>} exists=$([ -n "${SSL_CERT:-}" ] && [ -f "$SSL_CERT" ] && echo yes || echo no)" >&2
    echo "  SSL_KEY=${SSL_KEY:-<not set>} exists=$([ -n "${SSL_KEY:-}" ] && [ -f "$SSL_KEY" ] && echo yes || echo no)" >&2
  else
    echo "[entrypoint] No SSL — rendering HTTP-only config" >&2
  fi
fi
echo "  BACKEND_URL=${BACKEND_URL}" >&2
echo "  MCP_URL=${MCP_URL:-<not set>}" >&2
echo "  MCP_READ_URL=${MCP_READ_URL:-<not set>}" >&2
echo "  MCP_ACTIONS_URL=${MCP_ACTIONS_URL:-<not set>}" >&2
echo "  ASSISTANT_URL=${ASSISTANT_URL:-<not set>}" >&2
echo "  WS_WORKER_HOST=${WS_WORKER_HOST:-<not set>}" >&2
envsubst '$BACKEND_URL $MCP_URL $MCP_READ_URL $MCP_ACTIONS_URL $ASSISTANT_URL $WS_WORKER_HOST $SSL_CERT $SSL_KEY' \
  < "$TMPL" \
  > /etc/nginx/conf.d/default.conf

# Show final config for debugging (optional; comment out in sensitive envs)
cat /etc/nginx/conf.d/default.conf >&2 || true

exec nginx -g 'daemon off;'
