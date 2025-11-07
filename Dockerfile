# ---- Base Node ----
FROM node:20.18.0-alpine3.20 AS base
WORKDIR /usr/src/app

# Copy project file
COPY ../package*.json ./

# ---- Dependencies ----
FROM base AS dependencies
WORKDIR /usr/src/app

# Install production dependencies
RUN npm install
RUN npm install -g @quasar/cli

# ---- Copy Files/Build ----
FROM dependencies AS build
# Copy app files
COPY . .

# Accept build arguments
ARG APP_VERSION
ARG COMMIT_SHA

# During the build stage, these values need to be available as environment variables
# so the Quasar build can access them
ENV APP_VERSION=${APP_VERSION}
ENV COMMIT_SHA=${COMMIT_SHA}

# Create a version.js file that can be imported directly
RUN echo "export const APP_VERSION = '${APP_VERSION}';" > /usr/src/app/src/version.js
RUN echo "export const COMMIT_SHA = '${COMMIT_SHA}';" >> /usr/src/app/src/version.js

RUN quasar build

RUN echo "$APP_VERSION" > /usr/src/app/dist/spa/app-version.txt && \
    echo "$COMMIT_SHA" > /usr/src/app/dist/spa/commit-sha.txt

# Remove devDependencies
RUN npm prune --omit=dev

# ---- Release with Nginx ----
FROM nginx:1.25-alpine AS release
ARG APP_VERSION
ARG COMMIT_SHA

# Copy built static files from build stage
COPY --from=build /usr/src/app/dist/spa /usr/share/nginx/html

# Copy nginx configuration template (envsubst will process it at startup)
COPY nginx.conf.template /etc/nginx/conf.d/default.conf.template

# Copy entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Create health check endpoint
RUN echo "healthy" > /usr/share/nginx/html/health

# Expose port 80 (nginx default)
EXPOSE 80

# Use entrypoint script to substitute env vars and start nginx
ENTRYPOINT ["/docker-entrypoint.sh"]
