/**
 * Test environment setup for Vitest
 * This file is automatically loaded by Vitest before tests run
 */
import { vi, it } from 'vitest'

// Set environment variables for tests
process.env.TEST_ENV = 'true'

// Set timezone to UTC for all tests to ensure consistency
process.env.TZ = 'UTC'

// Force CI environment variable to be set for vitest
process.env.CI = process.env.CI || 'false'

// Flags to control which tests to run
export const TEST_CONFIG = {
  // Skip tests that require network connection or external services
  SKIP_NETWORK_TESTS: process.env.CI === 'true' || process.env.SKIP_NETWORK_TESTS === 'true',

  // Skip flaky tests that might fail intermittently
  SKIP_FLAKY_TESTS: process.env.CI === 'true' || process.env.SKIP_FLAKY_TESTS === 'true',

  // Skip tests that are affected by timezone differences
  SKIP_TIMEZONE_TESTS: process.env.CI === 'true' || process.env.SKIP_TIMEZONE_TESTS === 'true'
}

// Make TEST_CONFIG available globally in tests
// @ts-expect-error - Defining global property
global.__TEST_CONFIG__ = TEST_CONFIG
// @ts-expect-error - Defining global property for browser env compatibility
globalThis.__TEST_CONFIG__ = TEST_CONFIG

// Export a special helper to use in test files for skipping network tests
export const skipNetworkTests = (title: string, fn: () => void) => {
  if (TEST_CONFIG.SKIP_NETWORK_TESTS) {
    it.skip(title, fn)
  } else {
    it(title, fn)
  }
}

console.log('Test environment configuration loaded:', TEST_CONFIG)

// Type definitions for global test config
declare global {
  // eslint-disable-next-line no-var
  var __TEST_CONFIG__: typeof TEST_CONFIG
}