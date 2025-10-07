# Multi-stage Dockerfile for quantFinance dashboard (Vue 3 + Vite)
# 1) Build stage: install deps & build static assets
# 2) Runtime stage: Nginx serves the built assets and proxies API requests to backend
#
# Usage:
#   docker build -t quant-dashboard --build-arg VITE_API_BASE=/api .
#   docker run -d -p 8080:80 \
#     -e BACKEND_URL=http://backend:3001 \
#     --name quant-dashboard quant-dashboard
#
# If your backend container is on the same Docker network and named `backend`,
# set BACKEND_URL to http://backend:3001 (FastAPI example). Adjust as needed.
# -----------------------------------------------------------------------------

########## Build Stage ##########
FROM node:20-alpine AS build
WORKDIR /app

# Enable corepack (optional, kept minimal) & install deps
# Copy only package manifests first for better layer caching
COPY package*.json ./

# Install dependencies (dev deps required for build)
# Using npm ci for reproducible installs. Falls back to npm install if no lock.
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Copy the rest of the source
COPY . .

# Build-time API base path (baked into bundle). Override with --build-arg.
ARG VITE_API_BASE=/api
ENV VITE_API_BASE=$VITE_API_BASE

# Vite will automatically use VITE_* env vars at build time.
RUN echo "Building with VITE_API_BASE=$VITE_API_BASE" && npm run build

########## Runtime Stage ##########
FROM nginx:1.27-alpine AS runtime

# Set backend URL env (can be overridden at runtime: -e BACKEND_URL=http://host.docker.internal:3001 )
ENV BACKEND_URL=http://backend:3001

# Copy built assets
COPY --from=build /app/dist /usr/share/nginx/html

# Provide custom nginx config (uses $BACKEND_URL via envsubst at startup)
COPY nginx.template.conf /etc/nginx/templates/default.conf.template

# Simple entrypoint to substitute environment vars into nginx conf
RUN apk add --no-cache bash gettext
COPY docker-entrypoint.sh /docker-entrypoint.d/10-envsubst.sh
RUN chmod +x /docker-entrypoint.d/10-envsubst.sh

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -q -O - http://localhost/ || exit 1

# Notes:
#  - To change the API base at RUNTIME without rebuilding, the frontend code currently fetches '/api/...'.
#    We proxy '/api' and '/records' to BACKEND_URL in nginx.template.conf so no rebuild is needed.
#  - To change at BUILD time (for absolute URLs in code) use --build-arg VITE_API_BASE.
#  - For local dev you can still run: docker run -p 5173:5173 node:20-alpine ... but this image is prod ready.

# Final image
# IMPORTANT: Do NOT set CMD to /docker-entrypoint.sh (ENTRYPOINT already points to it in the base image).
# Setting CMD to the entrypoint script causes it to exec itself (recursion) and exit immediately.
# We restore the default nginx CMD so the container stays in foreground.
CMD ["nginx", "-g", "daemon off;"]
