describe('Bluesky Event Creation and Deletion', () => {
  beforeEach(() => {
    // Log in as the Bluesky user.
    // Either add a custom command for it (e.g. cy.loginBluesky()) or use cy.login()
    // Here we use cy.login() with environment variables for a Bluesky test user
    cy.loginBluesky(Cypress.env('APP_TESTING_BLUESKY_EMAIL'), Cypress.env('APP_TESTING_BLUESKY_PASSWORD'))

    // Intercept the event creation API call.
    cy.intercept('POST', '/api/events', {
      statusCode: 201,
      body: { id: 123, slug: 'bluesky-event', name: 'Bluesky Event' }
    }).as('createEvent')

    // Intercept the event deletion API call.
    cy.intercept('DELETE', '/api/events/bluesky-event', {
      statusCode: 200,
      body: {}
    }).as('deleteEvent')
  })

  it('should create a Bluesky event and then delete it', () => {
    // Navigate to the event creation page.
    cy.visit('/events/new')

    // Fill out the event creation form. Adjust dataCy selectors as needed.
    cy.dataCy('event-name-input').should('be.visible').type('Bluesky Event')
    cy.dataCy('event-description').type('Test event created with Bluesky login')
    // Set additional fields (date/time, visibility, etc.) as required.

    // Submit the event form.
    cy.dataCy('event-publish').click()

    // Verify that the event is created by waiting for the POST call.
    cy.wait('@createEvent').then((interception) => {
      const eventSlug = interception.response?.body?.slug
      expect(eventSlug).to.equal('bluesky-event')

      // Navigate to the new event's page.
      cy.visit(`/events/${eventSlug}`)
    })

    // Now simulate deletion of the event.
    cy.dataCy('event-delete-button').should('be.visible').click()
    cy.wait('@deleteEvent').then((interception) => {
      expect(interception.response?.statusCode).to.equal(200)
      // Verify redirection (or absence of event) after deletion.
      cy.url().should('include', '/events')
    })
  })
})
