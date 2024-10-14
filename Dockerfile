# ---- Base Node ----
  FROM node:20.18.0-alpine3.20 AS base
  WORKDIR /usr/src/app

  # Copy project file
  COPY ../package*.json ./

  # ---- Dependencies ----
  FROM base AS dependencies
  WORKDIR /usr/src/app

  # Install production dependencies
  RUN ls -al

  RUN npm install
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

  RUN npm install -g @quasar/cli

  EXPOSE 9005
  CMD [ "quasar", "serve", "--history", "--port", "9005", "./dist/spa" ]
