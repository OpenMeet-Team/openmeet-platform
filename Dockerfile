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

# ---- Release ----
FROM base AS release
ARG APP_VERSION
ARG COMMIT_SHA
COPY --from=dependencies /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/dist ./dist
COPY docker-entrypoint.sh /
RUN chmod +x /docker-entrypoint.sh

RUN npm install -g @quasar/cli

EXPOSE 9005
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD [ "quasar", "serve", "--history", "--port", "9005", "./dist/spa" ]
