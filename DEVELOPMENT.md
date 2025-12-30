# Local Development Setup Guide

This guide explains how to run the OpenMeet Platform (frontend) locally for development.

## Prerequisites

- Node.js v22+ (required by matrix-js-sdk)
- npm (>= 6.13.4)
- Docker & Docker Compose (optional, for production-like setup)

## Quick Start (npm dev - Recommended)

The simplest way to get started. Works with local API or remote dev API.

```bash
# 1. Install dependencies
npm install

# 2. Copy environment files
cp .env.example .env
cp public/config.example.json public/config.json

# 3. Start the dev server
npm run dev
# Opens browser at http://localhost:9005
```

The default config points to `http://localhost:3000` (local API) with tenant ID `testing`.

**To use remote dev API instead**, edit `public/config.json`:
```json
{
  "APP_API_URL": "https://api-dev.openmeet.net",
  "APP_TENANT_ID": "testing"
}
```

## Quick Start (Docker Compose)

Runs with nginx reverse proxy (closer to production).

```bash
# 1. Install dependencies first (prevents Docker permission issues)
npm install

# 2. Copy environment files
cp .env.example .env
cp public/config.example.json public/config.json

# 3. Create the shared network (if not already created by API)
docker network create api-network 2>/dev/null || true

# 4. Start platform with Docker
docker compose -f docker-compose-dev.yml up

# Access via http://localhost:9005
```

**To use remote dev API** (no local API needed):
```bash
BACKEND_DOMAIN=https://api-dev.openmeet.net docker compose -f docker-compose-dev.yml up
```

> **Note:** You may see `Error: spawn xdg-open ENOENT` in the logs - this is harmless. The container is trying to open a browser, which isn't possible in Docker.

## Configuration

The platform uses two configuration mechanisms:

| File | Purpose | When Used |
|------|---------|-----------|
| `.env` | Dev server settings, test credentials | Build-time, testing |
| `public/config.json` | API URL, tenant ID, OAuth | Runtime (fetched by browser) |

### public/config.json (Runtime Config)

The browser fetches this at runtime. Default values work out of the box with local API:

```json
{
  "APP_API_URL": "http://localhost:3000",
  "APP_TENANT_ID": "testing",
  "APP_TENANT_NAME": "OpenMeet Dev",
  "APP_TENANT_DESCRIPTION": "Development environment",
  "NODE_ENV": "development"
}
```

> **Important:** The browser calls the API directly, so always use `localhost:3000` (not Docker hostnames like `api:3000`).

For production deployments, see `public/config.production.example.json` which includes additional options:
- OAuth providers (Google, GitHub)
- Analytics (PostHog, HubSpot)
- Matrix chat integration
- Support/billing links

### .env (Build-time / Test Config)

Default values work out of the box:

```bash
# Dev server
APP_DEV_SERVER_OPEN=true    # Opens browser automatically
APP_DEV_SERVER_PORT=9005

# Tenant (must match public/config.json)
APP_TENANT_ID=testing

# Testing credentials (for Cypress e2e tests)
APP_TESTING_USER_EMAIL=test@openmeet.net
APP_TESTING_USER_PASSWORD=your-test-password
APP_TESTING_API_URL=http://localhost:3000
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

### Connecting to Different APIs

Override `BACKEND_DOMAIN` to route nginx to different API backends:

```bash
# Default: Local API in Docker (requires openmeet-api running)
docker compose -f docker-compose-dev.yml up

# Remote dev API (no local API needed)
BACKEND_DOMAIN=https://api-dev.openmeet.net docker compose -f docker-compose-dev.yml up

# Local API on host via npm (API running with `npm run start:dev`)
BACKEND_DOMAIN=http://host.docker.internal:3000 docker compose -f docker-compose-dev.yml up
```

### Network Requirements

The Docker setup uses a shared `api-network`. Create it if not already created by openmeet-api:

```bash
docker network create api-network
```

## Troubleshooting

### "xdg-open ENOENT" error in Docker

This error is harmless - the container tries to open a browser (due to `APP_DEV_SERVER_OPEN=true`) but can't. The dev server still works fine at http://localhost:9005.

### "network api-network not found"

Create the shared network:

```bash
docker network create api-network
```

Or just use `npm run dev` instead (no Docker needed).

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

## Building Android App (Capacitor)

The platform can be built as a native Android app using Capacitor.

### Prerequisites

**Android Studio** - Download from [developer.android.com/studio](https://developer.android.com/studio)

Android Studio includes a bundled JRE (JBR - JetBrains Runtime) with Java 21, so no separate Java installation is needed.

### Building the App

```bash
# 1. Set JAVA_HOME to Android Studio's bundled JRE
export JAVA_HOME=~/android-studio/jbr

# 2. Build the Quasar app for Android
npx quasar build -m capacitor -T android

# 3. Install to connected device (USB debugging enabled)
cd src-capacitor/android
./gradlew installDebug
```

### Alternative: Build via Android Studio

```bash
# Build web assets and open in Android Studio
npx quasar build -m capacitor -T android --ide
```

From Android Studio, click the green play button to run on an emulator or connected device.

### Device Testing Commands

```bash
# List connected devices
~/Android/Sdk/platform-tools/adb devices -l

# Launch the app
~/Android/Sdk/platform-tools/adb shell monkey -p net.openmeet.platform -c android.intent.category.LAUNCHER 1

# View app logs (useful for debugging)
~/Android/Sdk/platform-tools/adb logcat | grep -i capacitor

# Pull screenshots from device
~/Android/Sdk/platform-tools/adb pull /sdcard/Pictures/Screenshots/ ./screenshots/

# Clear app data (reset to fresh state)
~/Android/Sdk/platform-tools/adb shell pm clear net.openmeet.platform
```

### Troubleshooting

**"SDK location not found"** - Create `src-capacitor/android/local.properties`:
```
sdk.dir=/home/YOUR_USERNAME/Android/Sdk
```

**"JAVA_HOME is set to an invalid directory"** - Use absolute path, not `~`:
```bash
export JAVA_HOME=/home/YOUR_USERNAME/android-studio/jbr
```

**"Security Manager not supported"** - Your system Java is too new. Use Android Studio's bundled JRE instead (see above).

## Useful Links

- **Platform:** https://platform.openmeet.net
- **API Docs:** https://api.openmeet.net/docs
- **Quasar Docs:** https://quasar.dev
- **Vue 3 Docs:** https://vuejs.org
- **Pinia Docs:** https://pinia.vuejs.org
