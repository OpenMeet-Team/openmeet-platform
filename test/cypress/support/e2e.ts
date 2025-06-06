// ***********************************************************
// This example support/e2e.ts is processed and
// loaded automatically before your e2e test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************
import '@cypress/code-coverage/support'

Cypress.on('uncaught:exception', (err) => {
  // Ignore ResizeObserver errors
  if (err.message.includes('ResizeObserver') ||
    err.message.includes('ResizeObserver loop completed with undelivered notifications') ||
    err.message.includes('ResizeObserver loop limit exceeded')) {
    return false
  }
  // Return true for other errors
  return true
})

import './commands'
import './bluesky-auth-command'

// Alternatively you can use CommonJS syntax:
// require('./commands')
