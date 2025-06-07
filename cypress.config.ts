import registerCodeCoverageTasks from '@cypress/code-coverage/task.js'
import { defineConfig } from 'cypress'
import dotenv from 'dotenv'
import startDevServer from '@quasar/quasar-app-extension-testing-e2e-cypress/cct-dev-server/index.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables from .env file
dotenv.config()

// Load acceptance test environment configuration
let envConfig = {}
let cypressEnvConfig = {}
try {
  const envFile = path.join(__dirname, 'test/cypress/config/env.json')
  if (fs.existsSync(envFile)) {
    const allEnvs = JSON.parse(fs.readFileSync(envFile, 'utf8'))
    const currentEnv = process.env.CYPRESS_ENV || 'local'
    envConfig = allEnvs[currentEnv] || {}
    cypressEnvConfig = envConfig // Fix: Use envConfig directly, not envConfig.cypressEnv
    console.log(`Loaded acceptance test config for environment: ${currentEnv}`)
    console.log(`Using tenant ID: ${cypressEnvConfig.APP_TESTING_TENANT_ID}`)
    console.log(`Using API URL: ${cypressEnvConfig.APP_TESTING_API_URL}`)
  }
} catch (error) {
  console.warn('Could not load acceptance test environment config:', error.message)
}

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
      // Merge environment variables with acceptance test config
      // Priority: process.env > cypressEnvConfig from env.json > defaults
      APP_TESTING_USER_EMAIL: process.env.APP_TESTING_USER_EMAIL || cypressEnvConfig.APP_TESTING_USER_EMAIL,
      APP_TESTING_USER_PASSWORD: process.env.APP_TESTING_USER_PASSWORD || cypressEnvConfig.APP_TESTING_USER_PASSWORD,
      APP_TESTING_ADMIN_EMAIL: process.env.APP_TESTING_ADMIN_EMAIL || cypressEnvConfig.APP_TESTING_ADMIN_EMAIL,
      APP_TESTING_ADMIN_PASSWORD: process.env.APP_TESTING_ADMIN_PASSWORD || cypressEnvConfig.APP_TESTING_ADMIN_PASSWORD,
      APP_TESTING_BLUESKY_EMAIL: process.env.APP_TESTING_BLUESKY_EMAIL || cypressEnvConfig.APP_TESTING_BLUESKY_EMAIL,
      APP_TESTING_BLUESKY_PASSWORD: process.env.APP_TESTING_BLUESKY_PASSWORD || cypressEnvConfig.APP_TESTING_BLUESKY_PASSWORD,
      APP_TESTING_BLUESKY_HANDLE: process.env.APP_TESTING_BLUESKY_HANDLE || cypressEnvConfig.APP_TESTING_BLUESKY_HANDLE,
      APP_TESTING_API_URL: process.env.APP_TESTING_API_URL || cypressEnvConfig.APP_TESTING_API_URL,
      APP_TESTING_TENANT_ID: process.env.APP_TESTING_TENANT_ID || cypressEnvConfig.APP_TESTING_TENANT_ID || 'testing',

      // Email testing configuration
      EMAIL_TESTING_MODE: process.env.EMAIL_TESTING_MODE || cypressEnvConfig.EMAIL_TESTING_MODE,
      MAILDEV_URL: process.env.MAILDEV_URL || cypressEnvConfig.MAILDEV_URL,
      DEV_IMAP_HOST: process.env.DEV_IMAP_HOST || cypressEnvConfig.DEV_IMAP_HOST,
      DEV_IMAP_PORT: process.env.DEV_IMAP_PORT || cypressEnvConfig.DEV_IMAP_PORT,
      DEV_MONITORING_EMAIL: process.env.DEV_MONITORING_EMAIL || cypressEnvConfig.DEV_MONITORING_EMAIL,
      DEV_MONITORING_PASSWORD: process.env.DEV_MONITORING_PASSWORD || cypressEnvConfig.DEV_MONITORING_PASSWORD,

      // Email service API configuration
      EMAIL_SERVICE_API_URL: process.env.EMAIL_SERVICE_API_URL || cypressEnvConfig.EMAIL_SERVICE_API_URL,
      EMAIL_SERVICE_API_KEY: process.env.EMAIL_SERVICE_API_KEY || cypressEnvConfig.EMAIL_SERVICE_API_KEY,
      EMAIL_SERVICE_SERVER_ID: process.env.EMAIL_SERVICE_SERVER_ID || cypressEnvConfig.EMAIL_SERVICE_SERVER_ID,

      // Performance testing configuration
      FAIL_ON_PERFORMANCE_ISSUES: process.env.FAIL_ON_PERFORMANCE_ISSUES || cypressEnvConfig.FAIL_ON_PERFORMANCE_ISSUES,

      // Production monitoring accounts
      PROD_MONITORING_EMAIL: process.env.PROD_MONITORING_EMAIL || cypressEnvConfig.PROD_MONITORING_EMAIL,
      PROD_MONITORING_PASSWORD: process.env.PROD_MONITORING_PASSWORD || cypressEnvConfig.PROD_MONITORING_PASSWORD
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
