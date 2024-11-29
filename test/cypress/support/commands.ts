// ***********************************************
// This example commands.ts shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add("login", (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add("drag", { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add("dismiss", { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite("visit", (originalFn, url, options) => { ... })

Cypress.Commands.add('login', (username: string, password: string) => {
  // cy.dataCy('header-mobile-menu').click()
  // cy.dataCy('header-mobile-menu-drawer').should('be.visible').within(() => {
  //   cy.dataCy('sign-in-button').click()
  // })
  cy.dataCy('header-sign-in-button').click()

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

// DO NOT REMOVE
// Imports Quasar Cypress AE predefined commands
import { registerCommands } from '@quasar/quasar-app-extension-testing-e2e-cypress'
registerCommands()
