// Test for Matrix chat in events using API for setup/teardown
describe('Matrix Chat in Events', () => {
  let eventSlug

  // Save original API URL before tests and restore after
  const originalApiUrl = Cypress.env('APP_TESTING_API_URL')

  // Create a test event directly via API before running tests
  before(() => {
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

    // Log the Cypress environment API URL for debugging
    cy.log(`Using API URL from Cypress env: ${Cypress.env('APP_TESTING_API_URL')}`)

    cy.visit('/')
    cy.login(Cypress.env('APP_TESTING_ADMIN_EMAIL'), Cypress.env('APP_TESTING_ADMIN_PASSWORD'))
    cy.get('[data-cy="header-profile-avatar"]', { timeout: 10000 }).should('be.visible')
  })

  // Clean up the event via API after tests
  after(() => {
    // Try to clean up the event using API directly instead of UI interactions
    // This is more reliable and doesn't depend on the UI being in a specific state
    cy.clearCookies()
    cy.clearLocalStorage()
    cy.visit('/')

    // Execute API-based cleanup without UI interactions
    cy.window().then(() => {
      // Get required environment variables with validation
      const adminEmail = Cypress.env('APP_TESTING_ADMIN_EMAIL')
      const adminPassword = Cypress.env('APP_TESTING_ADMIN_PASSWORD')
      const apiUrl = Cypress.env('APP_TESTING_API_URL')
      const tenantId = Cypress.env('APP_TESTING_TENANT_ID')

      // Validate that all required environment variables are set
      if (!adminEmail) {
        throw new Error('APP_TESTING_ADMIN_EMAIL environment variable is not set. This is required for cleanup.')
      }
      if (!adminPassword) {
        throw new Error('APP_TESTING_ADMIN_PASSWORD environment variable is not set. This is required for cleanup.')
      }
      if (!apiUrl) {
        throw new Error('APP_TESTING_API_URL environment variable is not set. This is required for cleanup.')
      }
      if (!tenantId) {
        throw new Error('APP_TESTING_TENANT_ID environment variable is not set. This is required for cleanup.')
      }

      cy.log(`Using API URL for cleanup: ${apiUrl}`)
      cy.log(`Using tenant ID: ${tenantId}`)
      cy.log(`Cleaning up event: ${eventSlug}`)

      // Use the window.fetch API directly to authenticate and delete the event
      if (eventSlug) {
        // First authenticate to get a token
        cy.request({
          method: 'POST',
          url: `${apiUrl}/api/v1/auth/login`,
          body: { email: adminEmail, password: adminPassword },
          headers: { 'X-Tenant-ID': tenantId },
          failOnStatusCode: false // Don't fail the test if auth fails
        }).then((authResponse) => {
          if (authResponse.status === 200 && authResponse.body?.token) {
            const token = authResponse.body.token

            // Now try to delete the event with the token
            cy.request({
              method: 'DELETE',
              url: `${apiUrl}/api/events/${eventSlug}`,
              headers: {
                Authorization: `Bearer ${token}`,
                'X-Tenant-ID': tenantId
              },
              failOnStatusCode: false // Don't fail the test if deletion fails
            }).then((deleteResponse) => {
              cy.log(`Deletion response: ${deleteResponse.status}`)
              if (deleteResponse.status >= 200 && deleteResponse.status < 300) {
                cy.log('Event deleted successfully via API')
              } else {
                cy.log(`Event deletion may have failed: ${deleteResponse.status}`)
              }
            })
          } else {
            cy.log('Authentication for cleanup failed, skipping event deletion')
          }

          // Restore original API URL when done regardless of deletion result
          if (originalApiUrl) {
            cy.log(`Restoring original API URL: ${originalApiUrl}`)
            Cypress.env('APP_TESTING_API_URL', originalApiUrl)
          }
        })
      } else {
        cy.log('Missing event slug, skipping cleanup')
        // Restore original API URL when done
        if (originalApiUrl) {
          cy.log(`Restoring original API URL: ${originalApiUrl}`)
          Cypress.env('APP_TESTING_API_URL', originalApiUrl)
        }
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

    // We only need to check for the chat-input, not the chat-list which might not be visible
    // when there are no messages
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
