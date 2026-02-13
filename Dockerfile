# Multi-stage Dockerfile for quantFinance dashboard (Vue 3 + Vite)
# Base Image: rockylinux:9 (User Preference for Speed/Caching)
# -----------------------------------------------------------------------------

########## Build Stage ##########
FROM rockylinux:9 AS build
WORKDIR /app

# Switch to Aliyun Mirror for Rocky Linux
RUN sed -e 's|^mirrorlist=|#mirrorlist=|g' \
    -e 's|^#baseurl=http://dl.rockylinux.org/$contentdir|baseurl=https://mirrors.aliyun.com/rockylinux|g' \
    -i.bak \
    /etc/yum.repos.d/rocky-*.repo && \
    dnf makecache

# Install Node.js 20
RUN curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - && \
    dnf install -y nodejs && \
    dnf clean all

# Copy package manifests
COPY package*.json ./

# Install dependencies with Taobao Mirror
RUN npm config set registry https://registry.npmmirror.com && \
    if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Copy source
COPY . .

# Build-time API base path
ARG VITE_API_BASE=/api
ENV VITE_API_BASE=$VITE_API_BASE

# Build
RUN echo "Building with VITE_API_BASE=$VITE_API_BASE" && npm run build

########## Runtime Stage ##########
FROM rockylinux:9 AS runtime

# Switch to Aliyun Mirror for Rocky Linux
RUN sed -e 's|^mirrorlist=|#mirrorlist=|g' \
    -e 's|^#baseurl=http://dl.rockylinux.org/$contentdir|baseurl=https://mirrors.aliyun.com/rockylinux|g' \
    -i.bak \
    /etc/yum.repos.d/rocky-*.repo && \
    dnf makecache

# Install Nginx and gettext (for envsubst)
RUN dnf install -y nginx gettext && dnf clean all

# Set backend URL env
ENV BACKEND_URL=http://backend:3001

# Copy built assets
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx config template
# Ensure the folder exists
RUN mkdir -p /etc/nginx/templates
COPY nginx.template.conf /etc/nginx/templates/default.conf.template

# Envsubst script
COPY docker-entrypoint.sh /docker-entrypoint.d/10-envsubst.sh
RUN chmod +x /docker-entrypoint.d/10-envsubst.sh

# Nginx config tweaks for Rocky default nginx
# Create required directories if they don't exist
RUN mkdir -p /var/cache/nginx /var/log/nginx && \
    chown -R nginx:nginx /var/cache/nginx /var/log/nginx /usr/share/nginx/html

# Expose port
EXPOSE 80

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD curl -f http://localhost/ || exit 1

# Entrypoint to run envsubst then nginx
# We need to adapt the entrypoint logic because the previous one assumed /docker-entrypoint.d/ functionality
# exists in the base image (which nginx:alpine has, but rockylinux:9 does NOT).
# So we need to write a simple shell script to handle it.

RUN echo '#!/bin/bash' > /entrypoint.sh && \
    echo 'set -e' >> /entrypoint.sh && \
    echo 'envsubst "\$BACKEND_URL" < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf' >> /entrypoint.sh && \
    echo 'exec nginx -g "daemon off;"' >> /entrypoint.sh && \
    chmod +x /entrypoint.sh

CMD ["/entrypoint.sh"]
