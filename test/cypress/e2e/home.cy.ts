// Use `cy.dataCy` custom command for more robust tests
// See https://docs.cypress.io/guides/references/best-practices.html#Selecting-Elements

import { ADMIN_EMAIL, ADMIN_PASSWORD } from '../utils/constants'

// ** This file is an example of how to write Cypress tests, you can safely delete it **

// This test will pass when run against a clean Quasar project
describe('HomePage', () => {
  describe.only('User Home', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/home/user', {
        statusCode: 200,
        fixture: 'home/user.json'
      }).as('getUserHome')
      cy.visit('/').then(() => {
        cy.login(ADMIN_EMAIL, ADMIN_PASSWORD)
        cy.wait('@getUserHome')
      })
    })

    it('should have home user page components', () => {
      cy.dataCy('header-logo-component').should('be.visible')
      cy.dataCy('organized-groups-item-component').should('be.visible')
      cy.dataCy('upcoming-events-item-component').should('be.visible')
      cy.dataCy('interests-item-component').should('be.visible')
      cy.dataCy('recent-event-drafts-item-component').should('be.visible')
      cy.dataCy('member-groups-item-component').should('be.visible')
    })
  })

  describe('Guest Home', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/home/guest', {
        statusCode: 200,
        fixture: 'home/guest.json'
      }).as('getGuestHome')
      cy.visit('/').then(() => {
        cy.wait('@getGuestHome')
      })
    })

    it('should have logo', () => {
      cy.dataCy('header-logo-component').should('be.visible')
    })

    it('should have featured groups', () => {
      cy.dataCy('groups-item-component').should('be.visible')
    })

    it('should have upcoming events', () => {
      cy.dataCy('events-item-component').should('be.visible')
    })

    it('should have categories', () => {
      cy.dataCy('categories-item-component').should('be.visible')
    })

    it('should have interests', () => {
      cy.dataCy('interests-item-component').should('be.visible')
    })
  })
})
