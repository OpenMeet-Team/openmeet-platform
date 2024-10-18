// Use `cy.dataCy` custom command for more robust tests
// See https://docs.cypress.io/guides/references/best-practices.html#Selecting-Elements

// ** This file is an example of how to write Cypress tests, you can safely delete it **

// This test will pass when run against a clean Quasar project
describe('HomePage', () => {
  beforeEach(() => {
    cy.intercept('GET', '/api/home', {
      statusCode: 200
    }).as('getHome')
    cy.visit('/')
  })

  it('--- Should display correct page title', () => {
    cy.title().should('include', 'OpenMeet')
  })

  it('--- header has logo', () => {
    // cy.wait('@getHome')
    cy.dataCy('header-logo-component').should('be.visible')
  })
})

// Workaround for Cypress AE + TS + Vite
// See: https://github.com/quasarframework/quasar-testing/issues/262#issuecomment-1154127497
export {}
