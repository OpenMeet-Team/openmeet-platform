describe('Matrix User Provisioning', () => {
  // Before each test, intercept API calls
  beforeEach(() => {
    // Mock the auth API response with a user missing a Matrix ID
    cy.intercept('GET', '/api/v1/auth/me', {
      body: {
        id: 22,
        email: 'test@example.com',
        name: 'Test User',
        ulid: 'TEST123',
        slug: 'test-user'
        // No Matrix user ID
      }
    }).as('getMe')

    // Mock the event data
    cy.intercept('GET', '/api/events/*', {
      body: {
        id: 1,
        name: 'Test Event',
        slug: 'test-event',
        description: 'A test event',
        visibility: 'public',
        attendee: {
          role: {
            name: 'attendee',
            permissions: [{ name: 'read_discussion' }, { name: 'write_discussion' }]
          }
        }
      }
    }).as('getEvent')

    // Mock the discussion messages
    cy.intercept('GET', '/api/events/*/discussions*', {
      body: {
        messages: [],
        end: ''
      }
    }).as('getMessages')
  })

  it('should provision a Matrix user ID when accessing event discussion', () => {
    // Mock the Matrix provisioning endpoint
    cy.intercept('POST', '/api/matrix/provision-user', {
      body: {
        matrixUserId: '@testuser:matrix.openmeet.net',
        matrixAccessToken: 'mock-token-123',
        matrixDeviceId: 'mock-device-456'
      }
    }).as('provisionMatrix')

    // Visit the event page
    cy.visit('/event/test-event')

    // Wait for the page to load
    cy.wait('@getEvent')
    cy.wait('@getMessages')

    // Verify the Matrix provisioning API was called
    cy.wait('@provisionMatrix').then((interception) => {
      expect(interception.response?.statusCode).to.equal(200)
      expect(interception.response?.body).to.have.property('matrixUserId')
    })
  })

  it('should handle Matrix provisioning errors gracefully', () => {
    // Mock a failed Matrix provisioning request
    cy.intercept('POST', '/api/matrix/provision-user', {
      statusCode: 500,
      body: {
        message: 'Failed to provision Matrix user'
      }
    }).as('provisionMatrixError')

    // Spy on console.error
    cy.window().then((win) => {
      cy.spy(win.console, 'error').as('consoleError')
    })

    // Visit the event page
    cy.visit('/event/test-event')

    // Wait for the page to load
    cy.wait('@getEvent')
    cy.wait('@getMessages')
    cy.wait('@provisionMatrixError')

    // Try to send a message
    cy.get('input[label="Leave a new comment"]').type('Test message{enter}')

    // Verify error was logged
    cy.get('@consoleError').should('be.calledWith',
      Cypress.sinon.match(/Failed to provision Matrix user/)
    )
  })
})
