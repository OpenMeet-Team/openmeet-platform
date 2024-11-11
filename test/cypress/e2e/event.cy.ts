import { EventEntity, EventVisibility } from 'src/types'

describe('EventPage', () => {
  const event = {
    id: 1,
    slug: 'event-one',
    name: 'Event One',
    description: 'Description for event one'
  }

  describe('when the group visibility is public', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/events/1', {
        statusCode: 200,
        body: {
          ...event,
          visibility: EventVisibility.Public
        } as EventEntity
      }).as('getEvent')
      cy.intercept('GET', '/api/events/1/recommended-events', {
        statusCode: 200,
        body: [{ id: 1, name: 'Event One' }]
      }).as('getRecommendedEvents')
      cy.intercept('POST', '/api/auth/login', {
        statusCode: 200
      }).as('login')

      cy.visit('/events/event-one--b').then(() => {
        cy.wait('@getEvent')
        cy.wait('@getRecommendedEvents')
      })
    })

    it('should display the event', () => {
      cy.dataCy('event-name').should('be.visible')
    })

    it('should display the join event button', () => {
      cy.dataCy('event-attend-button').should('be.visible')
    })

    it('should display login popup when clicking on join event button', () => {
      cy.dataCy('event-attend-button').click()
      cy.dataCy('login-form').should('be.visible')
    })

    it('should join the event when clicking on join event button', () => {
      cy.dataCy('event-attend-button').click()
      cy.dataCy('login-form').should('be.visible')
      cy.dataCy('login-email').type(Cypress.env('APP_TESTING_USER_EMAIL'))
      cy.dataCy('login-password').type(Cypress.env('APP_TESTING_USER_PASSWORD'))
      cy.dataCy('login-submit').click()
      cy.dataCy('event-attend-button').should('be.visible').click()
    })

    it('should display the recommended events', () => {
      cy.dataCy('similar-events-component').should('be.visible')
    })
  })

  describe('when the group visibility is private', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/events/1', {
        statusCode: 200,
        body: { ...event, visibility: EventVisibility.Private } as EventEntity
      }).as('getEvent')

      cy.visit('/events/event-one--b').then(() => {
        cy.wait('@getEvent')
      })
    })

    it('should display the request to join event button', () => {
      cy.dataCy('event-attend-button').should('be.visible')
    })
  })

  describe('when the group visibility is authenticated', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/events/1', {
        statusCode: 200,
        body: { ...event, visibility: EventVisibility.Authenticated } as EventEntity
      }).as('getEvent')

      cy.visit('/events/event-one--b').then(() => {
        cy.wait('@getEvent')
      })
    })
  })
})
