/**
 * Configuration for running acceptance tests against different environments
 *
 * This file loads environment-specific configurations from env.json and merges
 * them with default settings and environment variables.
 *
 * Usage:
 * - Development: npm run test:e2e:acceptance:dev
 * - Staging: npm run test:e2e:acceptance:staging
 * - Production smoke tests: npm run test:e2e:acceptance:prod
 */

import * as fs from 'fs'
import * as path from 'path'

export interface AcceptanceTestConfig {
  name: string
  baseUrl: string
  apiUrl: string
  tenantId: string
  testUserPattern: string
  // Email configuration for checking real email delivery
  emailConfig?: {
    imapHost?: string
    imapPort?: number
    // For production, we might use read-only monitoring accounts
    monitoringEmail?: string
    monitoringPassword?: string
  }
  // Feature flags for environment-specific behavior
  features: {
    testUserRegistration: boolean
    dataCleanup: boolean
    emailVerification: boolean
    matrixChat: boolean
    externalCalendar: boolean
    blueskyIntegration: boolean
  }
  // Performance thresholds
  performance: {
    pageLoadTimeout: number
    apiTimeout: number
    maxLoadTime: number
    // Performance monitoring thresholds
    thresholds?: {
      pageLoad: number
      apiResponse: number
      firstContentfulPaint: number
      largestContentfulPaint: number
      cumulativeLayoutShift: number
    }
  }
}

// Load environment configurations from env.json
function loadEnvironmentConfigs (): Record<string, Partial<AcceptanceTestConfig>> {
  try {
    const envFilePath = path.join(__dirname, 'env.json')
    if (fs.existsSync(envFilePath)) {
      const envConfigs = JSON.parse(fs.readFileSync(envFilePath, 'utf8'))
      console.log('Loaded environment configurations from env.json')
      return envConfigs
    } else {
      console.warn('env.json not found, using default configurations')
      return {}
    }
  } catch (error) {
    console.warn('Failed to load env.json:', error.message)
    return {}
  }
}

const envConfigs = loadEnvironmentConfigs()

// Default configurations that can be overridden by env.json
const defaultConfigs: Record<string, AcceptanceTestConfig> = {
  local: {
    name: 'Local Development',
    baseUrl: 'http://localhost:8087',
    apiUrl: 'http://localhost:3333',
    tenantId: 'lsdfaopkljdfs',
    testUserPattern: 'openmeet-test-local',
    features: {
      testUserRegistration: true,
      dataCleanup: true,
      emailVerification: false, // Maildev in local
      matrixChat: true,
      externalCalendar: false,
      blueskyIntegration: false
    },
    performance: {
      pageLoadTimeout: 30000,
      apiTimeout: 10000,
      maxLoadTime: 5000,
      thresholds: {
        pageLoad: 10000, // 10 seconds for local dev
        apiResponse: 5000, // 5 seconds for API responses
        firstContentfulPaint: 8000, // 8 seconds for FCP
        largestContentfulPaint: 10000, // 10 seconds for LCP
        cumulativeLayoutShift: 0.3
      }
    }
  },

  dev: {
    name: 'Development Environment',
    baseUrl: 'https://platform-dev.openmeet.net',
    apiUrl: 'https://api-dev.openmeet.net',
    tenantId: 'lsdfaopkljdfs',
    testUserPattern: 'openmeet-test-dev',
    emailConfig: {
      // These would be set via environment variables or env.json
      imapHost: process.env.DEV_IMAP_HOST,
      imapPort: parseInt(process.env.DEV_IMAP_PORT || '993'),
      monitoringEmail: process.env.DEV_MONITORING_EMAIL,
      monitoringPassword: process.env.DEV_MONITORING_PASSWORD
    },
    features: {
      testUserRegistration: true,
      dataCleanup: true,
      emailVerification: true,
      matrixChat: true,
      externalCalendar: true,
      blueskyIntegration: true
    },
    performance: {
      pageLoadTimeout: 30000,
      apiTimeout: 15000,
      maxLoadTime: 3000,
      thresholds: {
        pageLoad: 5000, // 5 seconds for dev environment
        apiResponse: 3000, // 3 seconds for API responses
        firstContentfulPaint: 3000, // 3 seconds for FCP
        largestContentfulPaint: 5000, // 5 seconds for LCP
        cumulativeLayoutShift: 0.2
      }
    }
  },

  staging: {
    name: 'Staging Environment',
    baseUrl: 'https://platform-staging.openmeet.net',
    apiUrl: 'https://api-staging.openmeet.net',
    tenantId: 'lsdfaopkljdfs',
    testUserPattern: 'openmeet-test-staging',
    emailConfig: {
      imapHost: process.env.STAGING_IMAP_HOST,
      imapPort: parseInt(process.env.STAGING_IMAP_PORT || '993'),
      monitoringEmail: process.env.STAGING_MONITORING_EMAIL,
      monitoringPassword: process.env.STAGING_MONITORING_PASSWORD
    },
    features: {
      testUserRegistration: true,
      dataCleanup: true,
      emailVerification: true,
      matrixChat: true,
      externalCalendar: true,
      blueskyIntegration: true
    },
    performance: {
      pageLoadTimeout: 20000,
      apiTimeout: 10000,
      maxLoadTime: 2500,
      thresholds: {
        pageLoad: 4000, // 4 seconds for staging
        apiResponse: 2000, // 2 seconds for API responses
        firstContentfulPaint: 2500, // 2.5 seconds for FCP
        largestContentfulPaint: 4000, // 4 seconds for LCP
        cumulativeLayoutShift: 0.15
      }
    }
  },

  prod: {
    name: 'Production Environment (Smoke Tests Only)',
    baseUrl: 'https://platform.openmeet.net',
    apiUrl: 'https://api.openmeet.net',
    tenantId: 'production-tenant-id', // Would need the actual production tenant ID
    testUserPattern: 'openmeet-test-prod-smoke',
    emailConfig: {
      // Production uses monitoring-only accounts
      monitoringEmail: process.env.PROD_MONITORING_EMAIL,
      monitoringPassword: process.env.PROD_MONITORING_PASSWORD
    },
    features: {
      testUserRegistration: false, // Don't create users in prod
      dataCleanup: false, // Don't delete data in prod
      emailVerification: false, // Just monitor, don't verify
      matrixChat: true,
      externalCalendar: true,
      blueskyIntegration: true
    },
    performance: {
      pageLoadTimeout: 15000,
      apiTimeout: 8000,
      maxLoadTime: 2000, // Stricter for production
      thresholds: {
        pageLoad: 3000, // 3 seconds for production
        apiResponse: 1500, // 1.5 seconds for API responses
        firstContentfulPaint: 2000, // 2 seconds for FCP
        largestContentfulPaint: 3000, // 3 seconds for LCP
        cumulativeLayoutShift: 0.1
      }
    }
  }
}

// Deep merge function to combine configurations
function deepMerge<T> (target: T, source: Partial<T>): T {
  const result = { ...target }

  for (const key in source) {
    if (source[key] !== undefined) {
      if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
        result[key] = deepMerge(result[key] || ({} as T[typeof key]), source[key] as Partial<T[typeof key]>)
      } else {
        result[key] = source[key] as T[typeof key]
      }
    }
  }

  return result
}

// Merge env.json configurations with defaults
export const environments: Record<string, AcceptanceTestConfig> = {}

for (const envName in defaultConfigs) {
  const defaultConfig = defaultConfigs[envName]
  const envOverrides = envConfigs[envName] || {}

  // Merge configurations with env.json taking precedence
  environments[envName] = deepMerge(defaultConfig, envOverrides)
}

// Helper function to get config for current environment
export function getEnvironmentConfig (): AcceptanceTestConfig {
  const env = process.env.CYPRESS_ENV || 'local'
  const config = environments[env]

  if (!config) {
    throw new Error(`Unknown environment: ${env}. Valid environments are: ${Object.keys(environments).join(', ')}`)
  }

  return config
}

// Helper to generate test user emails
export function generateTestUserEmail (role: string, config: AcceptanceTestConfig): string {
  const timestamp = Date.now()
  const random = Math.floor(Math.random() * 1000)
  return `${config.testUserPattern}.${role}-${timestamp}-${random}@openmeet.net`
}

// Helper to check if a feature is enabled
export function isFeatureEnabled (feature: keyof AcceptanceTestConfig['features'], config: AcceptanceTestConfig): boolean {
  return config.features[feature] === true
}
