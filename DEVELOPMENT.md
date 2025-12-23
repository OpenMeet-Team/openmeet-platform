# Local Development Setup Guide

This guide explains how to run the OpenMeet Platform (frontend) locally for development.

## Quick Start (Using Dev API)

The fastest way to get started - uses the remote dev API so you don't need to run the backend locally.

```bash
# 1. Install dependencies first (prevents Docker permission issues)
npm install

# 2. Copy environment files
cp .env.example .env
cp public/config.example.json public/config.json

# 3. Update public/config.json with your tenant:
#    "APP_API_URL": "https://api.dev.openmeet.net"
#    "APP_TENANT_ID": "your-tenant-id"  # Get from your team

# 4. Start the dev server
npm run dev
# Opens browser at http://localhost:9005
```

## Quick Start (Full Stack with Docker)

If you're running the API locally via openmeet-api's docker-compose:

```bash
# 1. Install dependencies first
npm install

# 2. Copy environment files
cp .env.example .env
cp public/config.example.json public/config.json

# 3. Update public/config.json for local API:
#    "APP_API_URL": "http://localhost:3000"
#    "APP_TENANT_ID": "your-tenant-id"  # Get from your team

# 4. Ensure API is running (in openmeet-api directory):
# docker compose -f docker-compose-dev.yml up -d

# 5. Start platform with Docker (nginx + dev server)
docker compose -f docker-compose-dev.yml up

# Access via http://localhost:9005
```

## Configuration

The platform uses two configuration mechanisms:

| File | Purpose | When Used |
|------|---------|-----------|
| `.env` | Dev server settings, test credentials | Build-time, testing |
| `public/config.json` | API URL, tenant ID, OAuth | Runtime (fetched by browser) |

### public/config.json (Runtime Config)

```json
{
  "APP_API_URL": "https://api.dev.openmeet.net",
  "APP_TENANT_ID": "your-tenant-id",
  "APP_TENANT_NAME": "Your Tenant Name",
  "APP_TENANT_DESCRIPTION": "Development tenant",
  "NODE_ENV": "development"
}
```

### .env (Build-time / Test Config)

```bash
# Dev server
APP_DEV_SERVER_OPEN=true
APP_DEV_SERVER_PORT=9005

# Tenant (must match public/config.json)
APP_TENANT_ID=your-tenant-id

# Testing credentials (for Cypress e2e tests)
APP_TESTING_USER_EMAIL=test@openmeet.net
APP_TESTING_USER_PASSWORD=your-test-password
APP_TESTING_API_URL=https://api.dev.openmeet.net
```

## Development Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Quasar dev server with hot reload |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npm run lint -- --fix` | Fix ESLint issues |
| `npx vue-tsc --noEmit` | TypeScript type check |

## Testing

```bash
# Unit tests (recommended - these are reliable)
npm run test:unit:ci           # Run all unit tests
npm run test:unit              # Watch mode
npx vitest run path/to/spec.ts # Run specific test

# E2E tests (⚠️ many are outdated)
npm run test:e2e               # Interactive Cypress
npm run test:e2e:ci            # Headless CI mode
```

> **Note:** Cypress E2E tests are currently out of date and will mostly fail. Unit tests are reliable. We'd love help updating the E2E tests!

## Docker Compose Details

The `docker-compose-dev.yml` runs two services:

| Service | Description |
|---------|-------------|
| `platform-dev` | Quasar dev server (internal, port 9005) |
| `platform-nginx` | Nginx reverse proxy with bot detection |

### Connecting to Local API

The nginx proxy can route API requests to different backends. Edit `docker-compose-dev.yml`:

```yaml
environment:
  # Option 1: Remote dev API (default)
  - BACKEND_DOMAIN=https://api.dev.openmeet.net

  # Option 2: Local API on host (npm run start:dev)
  # - BACKEND_DOMAIN=http://host.docker.internal:3000

  # Option 3: API container on shared network (recommended)
  # - BACKEND_DOMAIN=http://api:3000
```

### Network Requirements

If using Option 3 (shared network with API), the api-network must exist:

```bash
# This network is created by openmeet-api's docker-compose
docker network create api-network  # Or start API first
```

## Troubleshooting

### "api-network not found"

The platform's Docker setup expects the API to be running (which creates the network):

```bash
# Option A: Start API first
cd ../openmeet-api
docker compose -f docker-compose-dev.yml up -d

# Option B: Create network manually
docker network create api-network

# Option C: Just use npm run dev (no Docker needed)
npm run dev
```

### Hot reload not working

If changes aren't reflected:

1. Check the terminal for compile errors
2. Try hard refresh (Ctrl+Shift+R)
3. Clear browser cache and localStorage

### TypeScript errors

Use vue-tsc for type checking (there's no `npm run typecheck`):

```bash
npx vue-tsc --noEmit
```

### Store not updating in component

Use `storeToRefs()` for reactive store properties:

```typescript
import { storeToRefs } from 'pinia'
const authStore = useAuthStore()
const { user, token } = storeToRefs(authStore) // ✅ Reactive
// const { user } = authStore  // ❌ Not reactive
```

### Port 9005 already in use

```bash
# Find what's using the port
lsof -i :9005

# Kill the process or use a different port
APP_DEV_SERVER_PORT=9006 npm run dev
```

## Project Structure

```
src/
├── pages/           # Route pages (auto-registered)
├── components/      # Reusable Vue components
├── stores/          # Pinia state stores
├── composables/     # Vue composition utilities
├── api/             # API client functions
├── types/           # TypeScript interfaces
├── router/          # Vue Router configuration
├── boot/            # Quasar boot files (config, axios, auth)
└── utils/           # Helper functions

public/
└── config.json      # Runtime configuration (fetched by browser)

test/
├── vitest/          # Unit tests
└── cypress/         # E2E and component tests
```

## Useful Links

- **Dev Platform:** https://platform.dev.openmeet.net
- **Dev API Docs:** https://api.dev.openmeet.net/docs
- **Quasar Docs:** https://quasar.dev
- **Vue 3 Docs:** https://vuejs.org
- **Pinia Docs:** https://pinia.vuejs.org
