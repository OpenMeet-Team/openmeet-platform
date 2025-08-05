# OpenMeet Platform

## Building Communities Through Meaningful Connections

OpenMeet is an open-source community platform designed to help people overcome isolation and build stronger local connections. Our mission is to strengthen local communities by making it easier for people to meet in person and build meaningful relationships.

Unlike corporate platforms that charge high fees and prioritize profit over community, OpenMeet is:
- **Free and open-source**: Accessible to everyone
- **Community-focused**: Designed to foster genuine face-to-face connections
- **Privacy-respecting**: Your personal information remains private and secure
- **Decentralized**: Putting community needs first

OpenMeet helps community members who want to be more social reach out and join events or create and share their own gatherings. Connect with your neighbors, build community, and have fun without sitting behind a desk or phone alone.

## Project Architecture

OpenMeet Platform is built with:
- **[Quasar Framework](https://quasar.dev/)**: A Vue.js based framework for building responsive web applications
- **[Vue 3](https://vuejs.org/)**: Progressive JavaScript framework for building user interfaces
- **[Pinia](https://pinia.vuejs.org/)**: State management for Vue applications
- **[TypeScript](https://www.typescriptlang.org/)**: Typed JavaScript for better developer experience
- **[Cypress](https://www.cypress.io/)**: End-to-end and component testing
- **[Vitest](https://vitest.dev/)**: Unit testing framework

The project follows a modular architecture with:
- `/src/components`: Reusable UI components
- `/src/pages`: Application pages and routes
- `/src/layouts`: Page layouts and structure
- `/src/stores`: Pinia state management
- `/src/boot`: Application initialization and plugins
- `/src/api`: API service integrations
- `/src/composables`: Reusable Vue composition functions
- `/src/utils`: Utility functions
- `/src/types`: TypeScript type definitions
- `/src/i18n`: Internationalization resources

## Getting Started

### Prerequisites
- Node.js (v20, v22, or v24)
- npm (>= 6.13.4) or yarn (>= 1.21.1)

### Install the dependencies
```bash
yarn
# or
npm install
```

### Configuration

#### Environment Variables
Copy the environment variables example file and set the values:
```bash
cp .env.example .env
```

Key environment variables for development:
- `APP_DEV_SERVER_PORT`: Port for the development server (default: 9005)
- `APP_DEV_SERVER_OPEN`: Automatically open browser on start (default: true)

#### Runtime Configuration
The application uses `/public/config.json` for runtime configuration. For development, you can copy the example:
```bash
cp public/config.example.json public/config.json
```

Key configuration options:
- `APP_API_URL`: Backend API URL
- `APP_TENANT_ID`: Your tenant identifier
- `APP_TENANT_NAME`: Your organization/community name
- `APP_TENANT_DESCRIPTION`: Description of your community
- `APP_TENANT_IMAGE`: Path to your organization's logo

### Development

Start the app in development mode (hot-code reloading, error reporting, etc.):
```bash
yarn dev
# or
npm run dev
```

### Linting

Lint the files:
```bash
yarn lint
# or
npm run lint
```

### Building for Production

Build the app for production:
```bash
yarn build
# or
npm run build
```

### Testing

#### Unit Tests
```bash
# Run unit tests
yarn test:unit
# or
npm run test:unit

# Run unit tests with UI
yarn test:unit:ui
# or
npm run test:unit:ui
```

#### End-to-End Tests
```bash
# Run E2E tests with Cypress UI
yarn test:e2e
# or
npm run test:e2e

# Run E2E tests in headless mode
yarn test:e2e:ci
# or
npm run test:e2e:ci

# Run against a specific URL
npx cypress run --config baseUrl=https://platform.openmeet.net
```

#### Component Tests
```bash
# Run component tests with Cypress UI
yarn test:component
# or
npm run test:component
```

### Docker Support

The project includes Docker configuration for containerized deployment:

```bash
# Build and run with Docker
docker build -t openmeet-platform .
docker run -p 80:80 openmeet-platform

# Or use docker-compose
docker-compose up
```

### Disable update checking 

    echo "local-dev" > public/commit-sha.txt
    echo "0.0.3" > public/app-version.txt


## Adding Variables to the Build
When adding new environment variables:
1. Add to `.env`
2. Add to `quasar.config.ts` (env section)
3. Add to `public/config.json` for runtime configuration

## Documentation

For more information about the Quasar Framework, check out:
- [Quasar Framework Documentation](https://quasar.dev/introduction-to-quasar)
- [Configuring quasar.config.js](https://v2.quasar.dev/quasar-cli-vite/quasar-config-js)

## Contributing

We welcome contributions to OpenMeet! Please feel free to submit issues and pull requests.
