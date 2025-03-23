import registerCodeCoverageTasks from '@cypress/code-coverage/task.js'
import { defineConfig } from 'cypress'
import dotenv from 'dotenv'
import startDevServer from '@quasar/quasar-app-extension-testing-e2e-cypress/cct-dev-server/index.js'

// Load environment variables from .env file
dotenv.config()

export default defineConfig({
  fixturesFolder: 'test/cypress/fixtures',
  screenshotsFolder: 'test/cypress/screenshots',
  videosFolder: 'test/cypress/videos',
  video: true,
  e2e: {
    setupNodeEvents (on, config) {
      registerCodeCoverageTasks(on, config)

      on('task', {
        log (message) {
          console.log(message)
          return null
        }
      })

      return config
    },
    env: {
      // These is place to set cypress.env() values
      APP_TESTING_USER_EMAIL: process.env.APP_TESTING_USER_EMAIL,
      APP_TESTING_USER_PASSWORD: process.env.APP_TESTING_USER_PASSWORD,
      APP_TESTING_ADMIN_EMAIL: process.env.APP_TESTING_ADMIN_EMAIL,
      APP_TESTING_ADMIN_PASSWORD: process.env.APP_TESTING_ADMIN_PASSWORD,
      APP_TESTING_BLUESKY_EMAIL: process.env.APP_TESTING_BLUESKY_EMAIL,
      APP_TESTING_BLUESKY_PASSWORD: process.env.APP_TESTING_BLUESKY_PASSWORD,
      APP_TESTING_BLUESKY_HANDLE: process.env.APP_TESTING_BLUESKY_HANDLE,
      APP_TESTING_API_URL: process.env.APP_TESTING_API_URL,
      APP_TESTING_TENANT_ID: process.env.APP_TESTING_TENANT_ID || 'testing'
    },
    baseUrl: 'http://localhost:8087/',
    supportFile: 'test/cypress/support/e2e.ts',
    specPattern: 'test/cypress/e2e/**/*.cy.{js,jsx,ts,tsx}'
  },
  component: {
    setupNodeEvents (on, config) {
      registerCodeCoverageTasks(on, config)

      on('task', {
        log (message) {
          console.log(message)
          return null
        }
      })

      return config
    },
    supportFile: 'test/cypress/support/component.ts',
    specPattern: 'src/**/*.cy.{js,jsx,ts,tsx}',
    indexHtmlFile: 'test/cypress/support/component-index.html',
    devServer: startDevServer
  }
})
