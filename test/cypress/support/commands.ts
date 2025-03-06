// ***********************************************
// This example commands.ts shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************

// Add type definitions for Cypress commands
// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace Cypress {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
  interface Chainable<Subject = any> {
    login(username: string, password: string): Chainable<void>
    loginPage(username: string, password: string): Chainable<void>
    logout(): Chainable<void>
    authenticateWithBluesky(): Chainable<void>
    // Add dataCy command type definition
    dataCy(value: string): Chainable<Element>
  }
}

// DO NOT REMOVE
// Imports Quasar Cypress AE predefined commands
import { registerCommands } from '@quasar/quasar-app-extension-testing-e2e-cypress'
registerCommands()

// Add Cypress commands
Cypress.Commands.add('login', (username: string, password: string) => {
  // cy.dataCy('header-mobile-menu').click()
  // cy.dataCy('header-mobile-menu-drawer').should('be.visible').within(() => {
  //   cy.dataCy('sign-in-button').click()
  // })
  cy.dataCy('header-sign-in-button').should('be.visible').click()

  cy.dataCy('login-form').should('be.visible')
  cy.dataCy('login-email').type(username)
  cy.dataCy('login-password').type(password)
  cy.dataCy('login-submit').click()
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
