# CLAUDE.md

This file provides guidance to Claude Code when working with OpenMeet Platform.

## Project Overview

Vue 3 + Quasar frontend for OpenMeet. Connects to the OpenMeet API backend.

## Local Development Setup

### Quick Start with Docker

```bash
# 1. Copy environment files
cp .env.example .env
cp public/config.example.json public/config.json

# 2. Edit configs (see templates below)

# 3. Create network if needed
docker network create api-network

# 4. Start with dev API
BACKEND_DOMAIN=https://api.dev.openmeet.net docker compose -f docker-compose-dev.yml up -d

# 5. Open http://localhost:9005
```

### Configuration Files

#### public/config.json (Runtime Config)

This is the main runtime configuration. Copy from `config.example.json` and update:

```json
{
  "APP_API_URL": "https://api.dev.openmeet.net",
  "APP_TENANT_ID": "lsdfaopkljdfs",
  "APP_TENANT_NAME": "OpenMeet",
  "APP_TENANT_DESCRIPTION": "Openmeet is a billionaire-proof platform for sharing events and creating communities.",
  "APP_TENANT_IMAGE": "/openmeet/openmeet-logo.png",
  "APP_MATRIX_HOMESERVER_URL": "https://matrix.dev.openmeet.net",
  "APP_MATRIX_SERVER_NAME": "matrix.openmeet.net",
  "APP_MAS_URL": "https://mas.dev.openmeet.net",
  "APP_MAS_SCOPES": "openid urn:matrix:org.matrix.msc2967.client:api:*",
  "APP_MAS_REDIRECT_PATH": "/auth/matrix/callback",
  "NODE_ENV": "development"
}
```

**Important:** Use `api.dev.openmeet.net` (with dots), not `api-dev.openmeet.net`.

#### .env (Build/Test Config)

Copy from `.env.example` and update for testing:

```bash
# Dev server
APP_DEV_SERVER_OPEN=true
APP_DEV_SERVER_PORT=9005

# Tenant (must match public/config.json)
APP_TENANT_ID=lsdfaopkljdfs

# Testing - get credentials from 1Password or team
APP_TESTING_USER_EMAIL=test@openmeet.net
APP_TESTING_USER_PASSWORD=<from-1password>
APP_TESTING_ADMIN_EMAIL=admin@openmeet.net
APP_TESTING_ADMIN_PASSWORD=<from-1password>
APP_TESTING_TENANT_ID=lsdfaopkljdfs
APP_TESTING_API_URL=https://api.dev.openmeet.net

# Matrix/MAS testing
MAS_SERVICE_URL=https://mas.dev.openmeet.net
MATRIX_HOMESERVER_URL=https://matrix.dev.openmeet.net

# Cypress
CYPRESS_BASE_URL=http://localhost:9005

# Docker compose backend
BACKEND_DOMAIN=https://api.dev.openmeet.net
```

## Common Commands

```bash
# Run dev server (native)
npm run dev

# Run dev server (Docker)
docker compose -f docker-compose-dev.yml up -d

# Run unit tests
npm run test:unit

# Run specific test file
npm run test:unit -- DatetimeComponent

# Run e2e tests
npm run test:e2e

# Lint
npm run lint

# Type check
npx vue-tsc --noEmit
```

## Project Structure

```
src/
├── components/       # Reusable Vue components
│   ├── common/       # Generic components (DatetimeComponent, etc.)
│   ├── event/        # Event-related components
│   └── group/        # Group-related components
├── pages/            # Route pages
├── stores/           # Pinia stores
├── services/         # API services
└── composables/      # Vue composables
```

## Testing

- Unit tests: `*.vitest.spec.ts` files alongside components
- E2E tests: `cypress/e2e/` directory
- Run unit tests before committing: `npm run test:unit`

## Environment URLs

| Environment | Platform | API |
|-------------|----------|-----|
| Dev | platform.dev.openmeet.net | api.dev.openmeet.net |
| Prod | platform.openmeet.net | api.openmeet.net |

**Note:** Dev URLs use dots (`.dev.`), not hyphens (`-dev.`).
