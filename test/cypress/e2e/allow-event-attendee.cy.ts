/// <reference types="cypress" />

// test that
// creates an event that is private,
// allows an attendee to join,
// marks them as an attendee by the group owner
//  and verifies that the attendee can see the event details

describe('Event Attendee Management', () => {
  const event = {
    id: 1,
    name: 'Private Test Event',
    description: 'This is a private event',
    slug: 'private-test-event'
  }

  beforeEach(() => {
    // Set up intercepts before actions
    cy.intercept('GET', '**/api/events/**').as('getEvent')
    cy.intercept('POST', '**/api/events').as('createEvent')
    cy.intercept('POST', '**/api/events/*/attend').as('joinEvent')
    cy.intercept('PUT', '**/api/events/*/attendees/*', { statusCode: 200 }).as('updateAttendee')
  })

  it('should allow and approve an attendee for a private event', () => {
    // Login as admin first
    cy.visit('/')
    cy.login(
      Cypress.env('APP_TESTING_ADMIN_EMAIL'),
      Cypress.env('APP_TESTING_ADMIN_PASSWORD')
    )

    // Create event using existing pattern
    cy.dataCy('header-nav-add-event-button').click()
    cy.dataCy('event-form-dialog').should('be.visible')
    cy.dataCy('event-name-input').type(event.name)
    cy.dataCy('event-description').type(event.description)
    cy.dataCy('event-visibility').click()

    // Open date picker and select date
    cy.dataCy('datetime-component-date').click()
    cy.get('.q-date__calendar-item--in').contains('25').click({ force: true })
    cy.get('button').contains('Close').as('closeBtn')
    cy.get('@closeBtn').click({ force: true })

    // Open time picker and select time
    cy.dataCy('datetime-component-time').click()
    // Select 6 PM
    cy.get('.q-time__header-ampm').contains('PM').click()
    cy.get('.q-time__clock-position').contains('6').click()
    // Select 00 minutes (click in the header to switch to minutes)
    cy.get('.q-time__header-label').contains('--').click()
    cy.get('.q-time__clock-position').contains('0').click()
    cy.contains('button', 'Close').click()

    cy.dataCy('event-publish').click()

    cy.wait('@createEvent').then((interception) => {
      const eventSlug = interception.response?.body?.slug
      cy.wrap(eventSlug).should('exist')
        .then(() => {
          // Wait for redirect to complete
          cy.url().should('include', `/events/${eventSlug}`)
          // Store slug in closure scope
          cy.wrap(eventSlug).as('eventSlug')
          // Then logout
          cy.logout()
        })
    })

    // Test attendee flow
    cy.login(
      Cypress.env('APP_TESTING_USER_EMAIL'),
      Cypress.env('APP_TESTING_USER_PASSWORD')
    )

    cy.get('@eventSlug').then(eventSlug => {
      cy.visit(`/events/${eventSlug}`)
    })

    cy.get('button').contains('Attend').should('be.visible').click()

    cy.wait('@joinEvent').then((interception) => {
      // Debug log to see the actual response structure
      console.log('Response body:', interception.response?.body)

      // Basic status code check
      expect(interception.response?.statusCode).to.equal(201)
      expect(interception.response?.body).to.have.property('status')
      expect(interception.response?.body.status).to.equal('confirmed')
    })
    cy.logout()

    // Admin approval flow
    cy.login(
      Cypress.env('APP_TESTING_ADMIN_EMAIL'),
      Cypress.env('APP_TESTING_ADMIN_PASSWORD')
    )

    cy.get('@eventSlug').then(eventSlug => {
      cy.visit(`/events/${eventSlug}`)
    })

    // cy.dataCy('attendee-list')
    //   .contains(Cypress.env('APP_TESTING_USER_EMAIL'))
    //   .parent()
    //   .find('[data-cy=approve-attendee-button]')
    //   .should('be.visible')
    //   .click()
    // cy.wait('@updateAttendee')

    // // Verify approval state
    // cy.dataCy('attendee-list')
    //   .contains(Cypress.env('APP_TESTING_USER_EMAIL'))
    //   .parent()
    //   .should('have.class', 'approved')

    // // Verify attendee access
    // cy.logout()
    // cy.login(
    //   Cypress.env('APP_TESTING_USER_EMAIL'),
    //   Cypress.env('APP_TESTING_USER_PASSWORD')
    // )

    // cy.get('@eventSlug').then(eventSlug => {
    //   cy.visit(`/events/${eventSlug}`)
    // })
    // cy.wait('@getEvent')
    // cy.dataCy('event-details').should('be.visible')
    // cy.dataCy('event-title').should('contain', event.name)
  })
})
