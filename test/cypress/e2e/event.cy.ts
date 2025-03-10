import { EventEntity, EventVisibility } from '../../../src/types'

describe('EventPage', () => {
  const event = {
    id: 1,
    slug: 'event-one',
    name: 'Event One',
    description: 'Description for event one'
  } as EventEntity

  describe('when the event visibility is public', () => {
    beforeEach(() => {
      cy.intercept('GET', `/api/events/${event.slug}`, {
        statusCode: 200,
        body: {
          ...event,
          visibility: EventVisibility.Public
        } as EventEntity
      }).as('getEvent')
      cy.intercept('GET', `/api/events/${event.slug}/recommended-events`, {
        statusCode: 200,
        body: [{ id: 1, name: 'Event One', slug: 'event-one' }]
      }).as('getRecommendedEvents')

      cy.visit(`/events/${event.slug}`).then(() => {
        cy.wait('@getEvent')
        cy.wait('@getRecommendedEvents')
      })
    })

    it('should display the event', () => {
      cy.dataCy('event-name').should('be.visible')
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

  describe('when the event visibility is private', () => {
    beforeEach(() => {
      cy.intercept('GET', `/api/events/${event.slug}`, {
        statusCode: 200,
        body: { ...event, visibility: EventVisibility.Private } as EventEntity
      }).as('getEvent')

      cy.visit(`/events/${event.slug}`).then(() => {
        cy.wait('@getEvent')
      })
    })

    it('should display the request to join event button', () => {
      cy.dataCy('event-attend-button').should('be.visible')
    })
  })

  describe('when the event visibility is authenticated', () => {
    beforeEach(() => {
      cy.intercept('GET', `/api/events/${event.slug}`, {
        statusCode: 200,
        body: {
          ...event,
          visibility: EventVisibility.Authenticated
        } as EventEntity
      }).as('getEvent')

      cy.visit(`/events/${event.slug}`).then(() => {
        cy.wait('@getEvent')
      })
    })

    it.skip('should attendees and discussion be hidden', () => {
      cy.dataCy('event-attendees').should('not.exist')
      cy.dataCy('event-discussion').should('not.exist')
    })
  })

  describe('when the event is not found', () => {
    beforeEach(() => {
      cy.visit('/events/not-found')
    })

    it('should display the event not found message', () => {
      cy.dataCy('event-not-found').should('be.visible')
    })
  })

  describe.skip('event approvalQuestion is set', () => {
    beforeEach(() => {
      cy.intercept('GET', `/api/events/${event.slug}`, {
        statusCode: 200,
        body: {
          ...event,
          visibility: EventVisibility.Public,
          approvalQuestion: 'Approval question',
          requireApproval: true
        } as EventEntity
      }).as('getEvent')
      cy.visit(`/events/${event.slug}`).then(() => {
        cy.login(Cypress.env('APP_TESTING_USER_EMAIL'), Cypress.env('APP_TESTING_USER_PASSWORD'))
        cy.visit(`/events/${event.slug}`).then(() => {
          cy.wait('@getEvent')
        })
      })
    })

    it('should display the approval question card', () => {
      cy.dataCy('event-attend-button').click()
      cy.dataCy('event-attend-dialog').should('be.visible').within(() => {
        cy.dataCy('approval-question-card').should('be.visible')
      })
    })
  })
})
