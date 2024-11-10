import registerCodeCoverageTasks from '@cypress/code-coverage/task'
import { injectQuasarDevServerConfig } from '@quasar/quasar-app-extension-testing-e2e-cypress/cct-dev-server'
import { defineConfig } from 'cypress'
import dotenv from 'dotenv'

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
      return config
    },
    env: {
      // These is place to set cypress.env() values
      APP_TENANT_ID: process.env.APP_TESTING_TENANT_ID || process.env.APP_TENANT_ID,
      APP_TESTING_USER_EMAIL: process.env.APP_TESTING_USER_EMAIL,
      APP_TESTING_USER_PASSWORD: process.env.APP_TESTING_USER_PASSWORD,
      APP_TESTING_ADMIN_EMAIL: process.env.APP_TESTING_ADMIN_EMAIL,
      APP_TESTING_ADMIN_PASSWORD: process.env.APP_TESTING_ADMIN_PASSWORD
    },
    baseUrl: 'http://localhost:8087/',
    supportFile: 'test/cypress/support/e2e.ts',
    specPattern: 'test/cypress/e2e/**/*.cy.{js,jsx,ts,tsx}'
  },
  component: {
    setupNodeEvents (on, config) {
      registerCodeCoverageTasks(on, config)
      return config
    },
    supportFile: 'test/cypress/support/component.ts',
    specPattern: 'src/**/*.cy.{js,jsx,ts,tsx}',
    indexHtmlFile: 'test/cypress/support/component-index.html',
    devServer: injectQuasarDevServerConfig()
  }
})
