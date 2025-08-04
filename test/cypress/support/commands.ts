// ***********************************************
// This example commands.ts shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************

// Use import for Cypress types instead of triple-slash reference
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import cypress = require('cypress');

// Add type definitions for custom commands using module augmentation
// This avoids using namespace syntax
declare module 'cypress' {
  interface Chainable {
    login(username: string, password: string): Chainable<void>
    loginPage(username: string, password: string): Chainable<void>
    logout(): Chainable<void>
    authenticateWithBluesky(): Chainable<void>
    // Add dataCy command type definition
    dataCy(value: string): Chainable<Element>

    // Event commands
    createEvent(name: string, options?: object): Chainable<string>
    deleteEvent(slug: string): Chainable<void>
    createEventApi(name: string, options?: object): Chainable<string>
    deleteEventApi(slug: string): Chainable<boolean>
  }
}

// DO NOT REMOVE
// Imports Quasar Cypress AE predefined commands
import { registerCommands } from '@quasar/quasar-app-extension-testing-e2e-cypress'
registerCommands()

// Add Cypress commands
Cypress.Commands.add('login', (username: string, password: string) => {
  // Try to close any modals or overlays that might be blocking the UI
  cy.get('body').then($body => {
    // If there's a modal backdrop, try to dismiss it
    if ($body.find('.q-dialog__backdrop').length > 0) {
      cy.get('.q-dialog__backdrop').click({ force: true })
    }
  })

  // Click sign in button with force option to bypass any overlays
  cy.dataCy('header-sign-in-button', { timeout: 15000 }).should('exist').click({ force: true })

  // Wait for login form and fill in credentials
  cy.dataCy('login-form').should('be.visible')

  // Safe way to chain commands by breaking after type()
  cy.dataCy('login-email').should('be.visible')
  cy.dataCy('login-email').clear()
  cy.dataCy('login-email').type(username)

  cy.dataCy('login-password').should('be.visible')
  cy.dataCy('login-password').clear()
  cy.dataCy('login-password').type(password)

  cy.dataCy('login-submit').click({ force: true })

  // Wait for login process to complete by checking for avatar
  cy.dataCy('header-profile-avatar', { timeout: 10000 }).should('be.visible')

  // Wait for the auth token to be set in localStorage
  cy.window({ timeout: 10000 }).then((win: Window) => {
    assert.isNotNull(win.localStorage.getItem('token'), 'Auth token should exist')
  })
})

Cypress.Commands.add('loginPage', (username: string, password: string) => {
  cy.dataCy('login-email').type(username)
  cy.dataCy('login-password').type(password)
  cy.dataCy('login-submit').click()
})

Cypress.Commands.add('logout', () => {
  // Click the avatar to open menu
  cy.dataCy('header-profile-avatar').click()

  // Click the logout menu item and wait for auth state to clear
  cy.contains('Logout').click({ force: true })

  cy.url().should('eq', Cypress.config().baseUrl)

  // Now check for the sign-in button
  cy.dataCy('header-sign-in-button').should('be.visible')
})

// Command to authenticate with Bluesky using the fixed implementation
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - Ignore the type error for this command
Cypress.Commands.add('authenticateWithBluesky', () => {
  // This command has been moved to bluesky-auth-command.ts
  // We're keeping this stub here for backward compatibility
  cy.log('Using the improved authenticateWithBluesky command from bluesky-auth-command.ts')
})

// Import event related commands
import './event-commands'
