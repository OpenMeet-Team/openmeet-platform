// Use `cy.dataCy` custom command for more robust tests
// See https://docs.cypress.io/guides/references/best-practices.html#Selecting-Elements

// ** This file is an example of how to write Cypress tests, you can safely delete it **

// This test will pass when run against a clean Quasar project
describe('HomePage', () => {
  beforeEach(() => {
    cy.intercept('GET', '/api/home/guest', {
      statusCode: 200
    }).as('getGuestHome')

    cy.visit('/')
  })

  describe('Guest Home', () => {
    it('should fetch the guest home data', () => {
      cy.wait('@getGuestHome')
    })

    it('should have logo', () => {
      cy.wait('@getGuestHome')
      cy.dataCy('header-logo-component').should('be.visible')
    })
  })
})

describe('User Home', () => {
  beforeEach(() => {
    cy.intercept('GET', '/api/home/user', {
      statusCode: 200
    }).as('getUserHome')
  })
})
