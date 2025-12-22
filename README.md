# OpenMeet Platform

## Find Your People. Build Your Community.

OpenMeet is a platform that makes it easy to find or create events and interest groups - whether you're new to an area, looking to expand your social circle, or want to connect with people who share your passions. From hiking meetups and book clubs to tech talks and hobby gatherings, OpenMeet helps you discover events and build communities around your interests.

**Why choose OpenMeet?**
- **People-first, not profit**: Built as community infrastructure, not a business model
- **Privacy-focused**: We won't sell your data or spam you with ads
- **Flexible connections**: Support for in-person, virtual, and hybrid gatherings
- **Open source**: Transparent, community-driven development

**Getting started is simple**: Browse events in your area, RSVP instantly, or create your own gathering in minutes. Share location details, send last-minute updates, and follow up with attendees after events. From neighborhood meetups to city-wide gatherings, OpenMeet provides the infrastructure you need to organize successful events and build meaningful connections.

Stop scrolling alone. Start building the community you want to be part of.

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
- Node.js (v22)
- npm (>= 6.13.4)

### Install the dependencies
```bash
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
npm run dev
```

### Linting

Lint the files:
```bash
npm run lint
```

### Building for Production

Build the app for production:
```bash
npm run build
```

### Testing

#### Unit Tests
```bash
# Run unit tests
npm run test:unit:ci
```

#### End-to-End Tests
```bash
# Run E2E tests with Cypress UI
npm run test:e2e

# Run E2E tests in headless mode
npm run test:e2e:ci

# Run against a specific URL
npx cypress run --config baseUrl=https://platform.openmeet.net
```

#### Component Tests
```bash
# Run component tests with Cypress UI
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

Check out our [good first issues](https://github.com/OpenMeet-Team/openmeet-platform/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) to get started, or join us on [Discord](https://discord.gg/eQcYADgnrc).

See [CONTRIBUTORS.md](CONTRIBUTORS.md) for the list of people who have helped build OpenMeet.
