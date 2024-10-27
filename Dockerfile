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

# Use build args for build-time variables
ARG APP_HUBSPOT_PORTAL_ID
ARG APP_HUBSPOT_FORM_ID

# Set the APP_ variables for the build
ENV APP_HUBSPOT_PORTAL_ID=${APP_HUBSPOT_PORTAL_ID}
ENV APP_HUBSPOT_FORM_ID=${APP_HUBSPOT_FORM_ID}

RUN quasar build

# Remove devDependencies
RUN npm prune --omit=dev

# ---- Release ----
FROM base AS release
COPY --from=dependencies /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/dist ./dist

RUN apk add --no-cache gettext

# Create template from the built index.html
RUN cp ./dist/spa/index.html ./dist/spa/index.html.template

# Modify the template to include our config script
RUN sed -i 's/<head>/<head><script>window.APP_CONFIG = {\
  APP_API_URL: "${APP_API_URL}",\
  APP_TENANT_ID: "${APP_TENANT_ID}",\
  APP_POSTHOG_KEY: "${APP_POSTHOG_KEY}",\
  NODE_ENV: "${NODE_ENV}"\
};<\/script>/' ./dist/spa/index.html.template

COPY docker-entrypoint.sh /
RUN chmod +x /docker-entrypoint.sh

RUN npm install -g @quasar/cli

EXPOSE 9005
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD [ "quasar", "serve", "--history", "--port", "9005", "./dist/spa" ]
