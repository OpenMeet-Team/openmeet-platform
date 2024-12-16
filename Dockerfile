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

# Echo them to verify they're set
RUN echo "Building version: ${APP_VERSION}"
RUN echo "Commit SHA: ${COMMIT_SHA}"


RUN quasar build

# Remove devDependencies
RUN npm prune --omit=dev

# ---- Release ----
FROM base AS release
ARG APP_VERSION
ARG COMMIT_SHA
COPY --from=dependencies /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/dist ./dist

RUN apk add --no-cache gettext

# Create template from the built index.html
RUN cp ./dist/spa/index.html ./dist/spa/index.html.template

# Create template from the built index.html with hardcoded version values
RUN sed -i "s/<head>/<head><script>window.APP_CONFIG = {\
  APP_VERSION: \"${APP_VERSION}\",\
  COMMIT_SHA: \"${COMMIT_SHA}\",\
  APP_API_URL: \"\${APP_API_URL}\",\
  APP_TENANT_ID: \"\${APP_TENANT_ID}\",\
  APP_POSTHOG_KEY: \"\${APP_POSTHOG_KEY}\",\
  APP_HUBSPOT_PORTAL_ID: \"\${APP_HUBSPOT_PORTAL_ID}\",\
  APP_HUBSPOT_FORM_ID: \"\${APP_HUBSPOT_FORM_ID}\",\
  APP_GOOGLE_CLIENT_ID: \"\${APP_GOOGLE_CLIENT_ID}\",\
  APP_GITHUB_CLIENT_ID: \"\${APP_GITHUB_CLIENT_ID}\",\
  APP_BLUESKY_CLIENT_ID: \"\${APP_BLUESKY_CLIENT_ID}\" \
};<\/script>/" ./dist/spa/index.html.template

COPY docker-entrypoint.sh /
RUN chmod +x /docker-entrypoint.sh

RUN npm install -g @quasar/cli

EXPOSE 9005
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD [ "quasar", "serve", "--history", "--port", "9005", "./dist/spa" ]
