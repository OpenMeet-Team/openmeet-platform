/**
 * Matrix Chat Integration Tests
 *
 * These tests verify the functionality of Matrix chat integration in events,
 * with focus on the automatic provisioning of Matrix users.
 */

describe('Matrix Chat in Events', () => {
  // Test event data
  const testEvent = {
    id: 1,
    name: 'Test Event With Chat',
    slug: 'test-event-chat',
    description: 'An event with Matrix chat integration',
    matrixRoomId: '!room123:matrix.openmeet.net'
  }

  describe('User without Matrix credentials', () => {
    beforeEach(() => {
      // Intercept auth API to return a user without Matrix credentials
      cy.intercept('GET', '/api/v1/auth/me', {
        body: {
          id: 1,
          email: Cypress.env('APP_TESTING_USER_EMAIL'),
          name: 'Test User',
          slug: 'test-user'
          // No Matrix credentials
        }
      }).as('getMe')

      // Intercept the event API
      cy.intercept('GET', `/api/events/${testEvent.slug}`, {
        body: {
          ...testEvent,
          attendee: {
            role: {
              name: 'attendee',
              permissions: [{ name: 'read_discussion' }, { name: 'write_discussion' }]
            }
          }
        }
      }).as('getEvent')

      // Mock the Matrix provisioning endpoint
      cy.intercept('POST', '/api/matrix/provision-user', {
        statusCode: 200,
        body: {
          matrixUserId: '@testuser:matrix.openmeet.net',
          matrixAccessToken: 'matrix_token_123',
          matrixDeviceId: 'device_123'
        }
      }).as('provisionMatrix')

      // Mock the Matrix chat messages API
      cy.intercept('GET', `/api/events/${testEvent.slug}/discussions*`, {
        body: {
          messages: [],
          end: ''
        }
      }).as('getMessages')

      // Visit the login page and login using environment variables
      cy.visit('/auth/login')
      cy.dataCy('login-form').should('be.visible')
      cy.dataCy('login-email').should('be.visible').type(Cypress.env('APP_TESTING_USER_EMAIL'))
      cy.dataCy('login-password').should('be.visible').type(Cypress.env('APP_TESTING_USER_PASSWORD'))
      cy.dataCy('login-submit').click()
    })

    it('should automatically provision Matrix credentials when accessing event chat', () => {
      // Visit the event page
      cy.visit(`/events/${testEvent.slug}`)
      cy.wait('@getEvent')

      // Wait for the Comments section to be visible (previously called "Discussion")
      cy.contains('Comments').click({ force: true })

      // Wait for the messages to load and Matrix provisioning to occur
      cy.wait('@getMessages')
      cy.wait('@provisionMatrix').then((interception) => {
        expect(interception.response?.statusCode).to.equal(200)
        expect(interception.response?.body).to.have.property('matrixUserId')
      })

      // The chat input should be available after provisioning
      cy.get('[data-cy="chat-input"]').should('be.visible')
    })

    it('should send and receive messages after provisioning', () => {
      // Set up message sending mock
      cy.intercept('POST', `/api/events/${testEvent.slug}/discussions`, {
        statusCode: 200,
        body: {
          event_id: 'evt123',
          content: {
            body: 'Test message',
            msgtype: 'm.text'
          },
          sender: '@testuser:matrix.openmeet.net',
          origin_server_ts: Date.now()
        }
      }).as('sendMessage')

      // Visit the event page
      cy.visit(`/events/${testEvent.slug}`)
      cy.wait('@getEvent')

      // Navigate to Comments section
      cy.contains('Comments').click({ force: true })
      cy.wait('@getMessages')
      cy.wait('@provisionMatrix')

      // Send a message
      cy.get('[data-cy="chat-input"]').should('be.visible').type('Test message')
      cy.get('[data-cy="send-message-button"]').should('be.visible').click()

      // Verify the message was sent
      cy.wait('@sendMessage').then((interception) => {
        expect(interception.request.body).to.deep.equal({
          message: 'Test message',
          topic: 'General'
        })
      })

      // Verify message appears in UI
      cy.contains('Test message').should('be.visible')
    })
  })

  describe('User with existing Matrix credentials', () => {
    beforeEach(() => {
      // Intercept auth API to return a user with Matrix credentials
      cy.intercept('GET', '/api/v1/auth/me', {
        body: {
          id: 1,
          email: Cypress.env('APP_TESTING_USER_EMAIL'),
          name: 'Test User',
          slug: 'test-user',
          matrixUserId: '@testuser:matrix.openmeet.net',
          matrixAccessToken: 'existing_token_456',
          matrixDeviceId: 'existing_device_456'
        }
      }).as('getMe')

      // Intercept the event API
      cy.intercept('GET', `/api/events/${testEvent.slug}`, {
        body: {
          ...testEvent,
          attendee: {
            role: {
              name: 'attendee',
              permissions: [{ name: 'read_discussion' }, { name: 'write_discussion' }]
            }
          }
        }
      }).as('getEvent')

      // Mock the Matrix chat messages API
      cy.intercept('GET', `/api/events/${testEvent.slug}/discussions*`, {
        body: {
          messages: [],
          end: ''
        }
      }).as('getMessages')

      // Visit the login page and login using environment variables
      cy.visit('/auth/login')
      cy.dataCy('login-form').should('be.visible')
      cy.dataCy('login-email').should('be.visible').type(Cypress.env('APP_TESTING_USER_EMAIL'))
      cy.dataCy('login-password').should('be.visible').type(Cypress.env('APP_TESTING_USER_PASSWORD'))
      cy.dataCy('login-submit').click()
    })

    it('should not attempt to provision Matrix credentials if already present', () => {
      // Set up a spy for the provisioning endpoint
      cy.intercept('POST', '/api/matrix/provision-user', () => {
        // This request should never happen
        throw new Error('Matrix provisioning was attempted when not needed')
      }).as('unexpectedProvisioning')

      // Visit the event page
      cy.visit(`/events/${testEvent.slug}`)
      cy.wait('@getEvent')

      // Navigate to Comments section
      cy.contains('Comments').click({ force: true })
      cy.wait('@getMessages')

      // The chat input should be immediately available without provisioning
      cy.get('[data-cy="chat-input"]').should('be.visible')

      // Ensure provisioning doesn't happen (without arbitrary waiting)
      cy.get('[data-cy="chat-input"]').should('be.visible')
      cy.get('[data-cy="send-message-button"]').should('be.visible')
    })
  })

  describe('WebSocket Connection with Tenant ID', () => {
    beforeEach(() => {
      // Set up a user with Matrix credentials
      cy.intercept('GET', '/api/v1/auth/me', {
        body: {
          id: 1,
          email: Cypress.env('APP_TESTING_USER_EMAIL'),
          name: 'Test User',
          slug: 'test-user',
          matrixUserId: '@testuser:matrix.openmeet.net',
          matrixAccessToken: 'matrix_token_123',
          matrixDeviceId: 'device_123'
        }
      }).as('getMe')

      // Mock the event details
      cy.intercept('GET', `/api/events/${testEvent.slug}`, {
        body: {
          ...testEvent,
          attendee: {
            role: {
              name: 'attendee',
              permissions: [{ name: 'read_discussion' }, { name: 'write_discussion' }]
            }
          }
        }
      }).as('getEvent')

      // Mock the Matrix WebSocket connection (Socket.IO)
      cy.intercept('GET', '/socket.io/*', (req) => {
        // Inspect URL for tenant ID
        const url = new URL(req.url)
        const tenantId = url.searchParams.get('tenantId')

        if (!tenantId) {
          req.reply({
            statusCode: 400,
            body: 'Missing tenant ID in WebSocket connection'
          })
        } else {
          // Allow the connection to proceed
          req.continue()
        }
      }).as('socketConnection')

      // Visit the login page and login using environment variables
      cy.visit('/auth/login')
      cy.dataCy('login-form').should('be.visible')
      cy.dataCy('login-email').should('be.visible').type(Cypress.env('APP_TESTING_USER_EMAIL'))
      cy.dataCy('login-password').should('be.visible').type(Cypress.env('APP_TESTING_USER_PASSWORD'))
      cy.dataCy('login-submit').click()
    })

    it('should include tenant ID in WebSocket connection', () => {
      // Visit the event page to trigger Matrix connection
      cy.visit(`/events/${testEvent.slug}`)
      cy.wait('@getEvent')

      // Navigate to Comments section
      cy.contains('Comments').click({ force: true })

      // Check that WebSocket connection was attempted with tenant ID
      cy.wait('@socketConnection').then((interception) => {
        const url = new URL(interception.request.url)
        // Use assert instead of expect to avoid lint error
        assert.isNotNull(url.searchParams.get('tenantId'), 'Tenant ID should be present in WebSocket URL')
      })
    })
  })

  describe('Error Handling', () => {
    beforeEach(() => {
      // Set up a user without Matrix credentials
      cy.intercept('GET', '/api/v1/auth/me', {
        body: {
          id: 1,
          email: Cypress.env('APP_TESTING_USER_EMAIL'),
          name: 'Test User',
          slug: 'test-user'
          // No Matrix credentials
        }
      }).as('getMe')

      // Mock the event API
      cy.intercept('GET', `/api/events/${testEvent.slug}`, {
        body: {
          ...testEvent,
          attendee: {
            role: {
              name: 'attendee',
              permissions: [{ name: 'read_discussion' }, { name: 'write_discussion' }]
            }
          }
        }
      }).as('getEvent')

      // Visit the login page and login using environment variables
      cy.visit('/auth/login')
      cy.dataCy('login-form').should('be.visible')
      cy.dataCy('login-email').should('be.visible').type(Cypress.env('APP_TESTING_USER_EMAIL'))
      cy.dataCy('login-password').should('be.visible').type(Cypress.env('APP_TESTING_USER_PASSWORD'))
      cy.dataCy('login-submit').click()
    })

    it('should handle Matrix provisioning failures gracefully', () => {
      // Mock a failed Matrix provisioning
      cy.intercept('POST', '/api/matrix/provision-user', {
        statusCode: 500,
        body: {
          message: 'Failed to provision Matrix user'
        }
      }).as('provisionMatrixFailure')

      // Spy on console.error
      cy.window().then((win) => {
        cy.spy(win.console, 'error').as('consoleError')
      })

      // Mock empty messages response
      cy.intercept('GET', `/api/events/${testEvent.slug}/discussions*`, {
        body: {
          messages: [],
          end: ''
        }
      }).as('getMessages')

      // Visit the event page
      cy.visit(`/events/${testEvent.slug}`)
      cy.wait('@getEvent')

      // Navigate to Comments section
      cy.contains('Comments').click({ force: true })
      cy.wait('@getMessages')
      cy.wait('@provisionMatrixFailure')

      // Attempt to send a message
      cy.get('[data-cy="chat-input"]').should('be.visible').type('Test message')
      cy.get('[data-cy="send-message-button"]').click()

      // Verify error was logged or notification was shown
      cy.get('@consoleError').should('be.called')

      // Look for error notification (implementation may vary)
      cy.contains('Failed to send message').should('exist')
    })
  })
})
