# ---- Base Node ----
FROM node:24-alpine AS base
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

# Copy nginx configuration template (nginx will process it automatically via envsubst)
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Create health check endpoint
RUN echo "healthy" > /usr/share/nginx/html/health

# Expose port 80 (nginx default)
EXPOSE 80

# Nginx:alpine automatically processes /etc/nginx/templates/*.template
# and substitutes environment variables at startup
CMD ["nginx", "-g", "daemon off;"]
