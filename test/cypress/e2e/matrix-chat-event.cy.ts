// Test for Matrix chat in events using API for setup/teardown
describe('Matrix Chat in Events', () => {
  let eventSlug

  // Save original API URL before tests and restore after
  const originalApiUrl = Cypress.env('APP_TESTING_API_URL')

  // Create a test event directly via API before running tests
  before(() => {
    // Override API URL to use localhost for API calls to avoid CORS
    Cypress.env('APP_TESTING_API_URL', 'http://localhost:3000')

    // Start with a clean slate
    cy.clearCookies()
    cy.clearLocalStorage()

    cy.visit('/')

    // Log in to get authentication token
    cy.login(Cypress.env('APP_TESTING_ADMIN_EMAIL'), Cypress.env('APP_TESTING_ADMIN_PASSWORD'))

    // Create event using the API command and capture its slug
    const timestamp = new Date().toISOString().replace(/[-:.]/g, '')
    const eventName = `Matrix Chat Test Event ${timestamp}`
    cy.createEventApi(eventName, {
      description: `Description for test event created at ${timestamp}`,
      status: 'published' // Ensure status is set to published
    }).then(slug => {
      eventSlug = slug
      cy.log(`Test will use event with slug: ${eventSlug}`)
    })
  })

  // Make sure we're logged in for each test
  beforeEach(() => {
    // Clear state and login
    cy.clearCookies()
    cy.clearLocalStorage()
    cy.visit('/')
    cy.login(Cypress.env('APP_TESTING_ADMIN_EMAIL'), Cypress.env('APP_TESTING_ADMIN_PASSWORD'))
    cy.get('[data-cy="header-profile-avatar"]', { timeout: 10000 }).should('be.visible')
  })

  // Clean up the event via API after tests
  after(() => {
    // Make sure we're logged in for cleanup
    cy.clearCookies()
    cy.clearLocalStorage()
    cy.visit('/')
    cy.login(Cypress.env('APP_TESTING_ADMIN_EMAIL'), Cypress.env('APP_TESTING_ADMIN_PASSWORD'))

    // Delete event using the API command
    cy.deleteEventApi(eventSlug).then(success => {
      if (!success) {
        cy.log('API deletion failed, falling back to UI deletion')
        cy.deleteEvent(eventSlug)
      }

      // Restore original API URL when done
      if (originalApiUrl) {
        cy.log(`Restoring original API URL: ${originalApiUrl}`)
        Cypress.env('APP_TESTING_API_URL', originalApiUrl)
      }
    })
  })

  it('should navigate to the event discussion tab', () => {
    // Go to the event page with added timeout for slower environments
    cy.visit(`/events/${eventSlug}`, { timeout: 30000 })

    // Log the current URL for debugging
    cy.url().then(url => {
      cy.log(`Navigated to ${url}`)
    })

    // Wait for the event page to load
    cy.contains(/Matrix Chat Test Event/, { timeout: 15000 }).should('be.visible')

    // Take a screenshot at this point
    cy.screenshot('event-page-loaded')

    // Click on the Discussions tab with explicit force option
    cy.contains(/Discussion|Chat/).should('be.visible').click({ force: true })

    // Verify that the chat container is visible with increased timeout
    cy.dataCy('chat-container').should('exist', { timeout: 15000 })
    cy.dataCy('chat-list').should('exist', { timeout: 10000 })
    cy.dataCy('chat-input').should('exist', { timeout: 10000 })
  })

  it.skip('should send and receive a chat message', () => {
    // Go to the event page
    cy.visit(`/events/${eventSlug}`, { timeout: 30000 })

    // Navigate to the Discussions tab with explicit force option
    cy.contains(/Discussion|Chat/).should('be.visible').click({ force: true })

    // Verify chat container exists with increased timeout
    cy.dataCy('chat-container').should('exist', { timeout: 15000 })
    cy.dataCy('chat-input').should('exist', { timeout: 10000 })

    // Type a test message with uniqueness
    const uniqueId = Math.floor(Math.random() * 100000)
    const testMessage = `Cypress test message ${uniqueId}`

    // Wait for input to be ready and type with a delay
    cy.dataCy('chat-input').should('be.visible').clear()
    cy.dataCy('chat-input').type(testMessage, { delay: 50 })

    // Send the message with force option
    cy.dataCy('chat-send-button').should('be.visible').click({ force: true })

    // Verify the message appears in the chat with increased timeout
    cy.contains(testMessage, { timeout: 20000 }).should('be.visible')

    // Take a screenshot for verification
    cy.screenshot('matrix-chat-event-message')
  })

  it.skip('should check WebSocket functionality', () => {
    // Go to the event page
    cy.visit(`/events/${eventSlug}`, { timeout: 30000 })

    // Navigate to the Discussions tab with explicit force option
    cy.contains(/Discussion|Chat/).should('be.visible').click({ force: true })

    // Check if WebSocket functionality is available
    // Matrix uses native WebSockets
    cy.window().should((win) => {
      assert.exists(win.WebSocket, 'WebSocket should be supported in the browser')
    })

    // Wait for Matrix connection to be established
    cy.dataCy('chat-container').should('exist', { timeout: 15000 })

    // Take a screenshot for verification
    cy.screenshot('matrix-websocket-check')
  })
})
