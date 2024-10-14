# ---- Base Node ----
  FROM node:20.18.0-alpine3.20 AS base
  WORKDIR /usr/src/app

  # Copy project file
  COPY package*.json ./

  # Copy ts config
  COPY tsconfig.json ./

  # ---- Dependencies ----
  FROM base AS dependencies
  # Install production dependencies
  RUN npm ci
  RUN npm install -g @quasar/cli

  # ---- Copy Files/Build ----
  FROM dependencies AS build
  # Copy app files
  COPY . .

  # Build app
  RUN quasar build

  # # Remove devDependencies
  RUN npm prune --production

  # ---- Release ----
  FROM base AS release
  # Copy production dependencies
  COPY --from=dependencies /usr/src/app/node_modules ./node_modules
  # Copy build files from build stage
  COPY --from=build /usr/src/app/dist ./dist

  EXPOSE 9005
  CMD [ "quasar", "serve", "--history", "--port", "9005", "./dist/spa" ]
