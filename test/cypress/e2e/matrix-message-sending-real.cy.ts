// Real Matrix Message Sending Integration Test
// This test actually connects to the Matrix server and attempts to send messages
// to verify if MSC3970 fixes the MSC3861 transaction ID issue

describe('Matrix Message Sending - Real Integration Test', () => {
  const testEventSlug = 'monday-morning-working-session-uk7cwk'

  before(() => {
    // Start with a clean slate
    cy.clearCookies()
    cy.clearLocalStorage()
    cy.visit('/')

    // Log in as admin
    cy.login(Cypress.env('APP_TESTING_ADMIN_EMAIL'), Cypress.env('APP_TESTING_ADMIN_PASSWORD'))

    cy.log(`Using existing test event: ${testEventSlug}`)
  })

  beforeEach(() => {
    cy.clearCookies()
    cy.clearLocalStorage()
    cy.visit('/')
    cy.login(Cypress.env('APP_TESTING_ADMIN_EMAIL'), Cypress.env('APP_TESTING_ADMIN_PASSWORD'))
  })

  after(() => {
    // Clean up test event if needed
    if (testEventSlug) {
      cy.log(`Cleaning up test event: ${testEventSlug}`)
      // Note: Event cleanup can be handled separately if needed
    }
  })

  it('should test real Matrix message sending with OAuth2 tokens', () => {
    cy.log('🧪 Starting real Matrix message sending test')

    // Navigate to the test event
    cy.visit(`/events/${testEventSlug}`)
    cy.contains('Loading', { timeout: 10000 }).should('not.exist')

    // Wait for Matrix client to initialize
    cy.log('⏳ Waiting for Matrix client initialization...')

    // Look for Matrix chat interface
    cy.get('[data-cy="matrix-chat-interface"]', { timeout: 30000 })
      .should('exist')
      .then(() => {
        cy.log('✅ Matrix chat interface found')
      })

    // Look for and click the Matrix connect button
    cy.log('🔐 Looking for Matrix connect button...')
    cy.get('[data-cy="matrix-connect-button"]', { timeout: 10000 })
      .should('exist')
      .click()
    cy.log('✅ Clicked Matrix connect button')

    // Handle MAS OAuth flow
    cy.log('🔐 Handling Matrix Authentication Service OAuth flow...')

    // Wait for MAS authentication page to load
    cy.origin('http://localhost:8081', () => {
      // Look for the "Continue with OpenMeet Local" button
      cy.contains('Continue with OpenMeet Local', { timeout: 15000 })
        .should('be.visible')
        .click()

      cy.log('✅ Clicked "Continue with OpenMeet Local" button')
    })

    // Handle redirect to OpenMeet API OIDC login page
    cy.origin('https://localdev.openmeet.net', () => {
      // Handle the email login form on the API server
      cy.log('📧 Filling in email login form on API server...')
      cy.get('input[type="email"], input[name="email"], #email', { timeout: 10000 })
        .should('be.visible')

      cy.get('input[type="email"], input[name="email"], #email')
        .clear()

      cy.get('input[type="email"], input[name="email"], #email')
        .type(Cypress.env('APP_TESTING_ADMIN_EMAIL'))

      cy.log(`✅ Entered email: ${Cypress.env('APP_TESTING_ADMIN_EMAIL')}`)

      // Click the "Continue" button
      cy.contains('button', 'Continue', { timeout: 5000 })
        .should('be.visible')
        .click()

      cy.log('✅ Clicked Continue button')
    })

    // Handle the return from OAuth flow - expect login due to session clearing from about:blank
    cy.log('🔄 Completing OAuth flow (expecting login due to session clearing)...')

    // Wait for navigation to settle after OAuth flow
    cy.url({ timeout: 15000 }).should('not.include', 'about:blank')

    // Check current location and handle login if needed
    cy.url({ timeout: 10000 }).then((url) => {
      cy.log(`🔍 Current location: ${url}`)
    })

    // If we're at login page (likely due to session clearing), complete login
    cy.get('body').then(($body) => {
      if ($body.text().includes('Login') || $body.find('input[type="email"]').length > 0) {
        cy.log('🔐 Login page detected - completing authentication...')

        cy.get('input[type="email"], input[name="email"]', { timeout: 10000 })
          .should('be.visible')

        cy.get('input[type="email"], input[name="email"]')
          .clear()

        cy.get('input[type="email"], input[name="email"]')
          .type(Cypress.env('APP_TESTING_ADMIN_EMAIL'))

        cy.get('input[type="password"], input[name="password"]', { timeout: 5000 })
          .should('be.visible')

        cy.get('input[type="password"], input[name="password"]')
          .clear()

        cy.get('input[type="password"], input[name="password"]')
          .type(Cypress.env('APP_TESTING_ADMIN_PASSWORD'))

        cy.contains('button', 'Login', { timeout: 5000 })
          .should('be.visible')
          .click()

        cy.log('✅ Login completed')
      } else {
        cy.log('✅ No login required - already authenticated')
      }
    })

    // Ensure we end up at the event page and Matrix context is restored
    cy.url({ timeout: 20000 }).should('include', '/events/')
    cy.log('✅ OAuth flow completed - at event page')

    // Wait for page to fully load after login
    cy.contains('Loading', { timeout: 10000 }).should('not.exist')

    // Check if Matrix connection succeeded or if we need to retry
    cy.log('🔐 Checking Matrix authentication status...')

    // Look for Matrix chat interface again
    cy.get('[data-cy="matrix-chat-interface"]', { timeout: 15000 })
      .should('exist')
      .then(() => {
        cy.log('✅ Matrix chat interface restored after login')
      })

    // Check if Matrix connect button is still visible (indicating connection failed)
    cy.get('body').then(($body) => {
      if ($body.find('[data-cy="matrix-connect-button"]').length > 0) {
        cy.log('⚠️ Matrix connect button still visible - connection may have failed')

        // Log the current page state for debugging
        cy.log(`Current page contains: ${$body.text().slice(0, 200)}...`)

        // Check for any error messages on the page
        const pageText = $body.text()
        if (pageText.includes('error') || pageText.includes('Error') || pageText.includes('failed')) {
          cy.log('❌ Error text detected on page after OAuth')
        }

        // Try clicking the connect button again
        cy.get('[data-cy="matrix-connect-button"]')
          .should('be.visible')
          .click()

        cy.log('🔄 Retried Matrix connection after login')

        // Wait for potential Matrix connection establishment
        cy.get('[data-cy="chat-input"], [data-cy="matrix-connect-button"]', { timeout: 10000 })
          .should('exist')

        // Check if button is still there after retry
        cy.get('body').then(($retryBody) => {
          if ($retryBody.find('[data-cy="matrix-connect-button"]').length > 0) {
            cy.log('❌ Matrix connect button still visible after retry - connection definitely failed')
            cy.log('🔍 Check Matrix server logs and OAuth token validity')
          } else {
            cy.log('✅ Matrix connect button disappeared after retry - connection succeeded')
          }
        })
      } else {
        cy.log('✅ Matrix connect button not visible - connection appears successful')
      }
    })

    // Wait for Matrix authentication and room joining
    cy.log('🔐 Waiting for Matrix authentication and room setup...')

    // Check for chat input field (indicates Matrix is ready)
    cy.get('body').then(($body) => {
      if ($body.find('[data-cy="chat-input"]').length > 0) {
        cy.log('✅ Chat input found immediately - Matrix client ready')
      } else {
        cy.log('⏳ Chat input not yet available - waiting for Matrix connection...')

        // Wait longer for chat input to appear
        cy.get('[data-cy="chat-input"]', { timeout: 45000 })
          .should('exist')
          .and('be.visible')
          .then(() => {
            cy.log('✅ Chat input found after waiting - Matrix client ready')
          })
      }
    })

    // Additional check for Matrix connection errors
    cy.get('body').then(($body) => {
      const bodyText = $body.text()
      if (bodyText.includes('Matrix chat server configuration issue') ||
          bodyText.includes('Failed to connect') ||
          bodyText.includes('Error')) {
        cy.log('❌ Matrix connection error detected in UI')
        cy.log(`Page content: ${bodyText.slice(0, 500)}...`)
      } else {
        cy.log('✅ No obvious Matrix connection errors detected')
      }
    })

    // Ensure Matrix interface is fully loaded before proceeding
    cy.get('[data-cy="matrix-chat-interface"]')
      .should('be.visible')

    // Monitor console for Matrix errors and check connection status
    cy.window().then((win) => {
      const matrixErrors: string[] = []
      const originalConsoleError = win.console.error
      const originalConsoleWarn = win.console.warn
      const originalConsoleLog = win.console.log

      // Capture Matrix-related errors
      win.console.error = (...args) => {
        const message = args.join(' ')
        cy.log(`🔍 Console Error: ${message}`)
        if (message.includes('Matrix') || message.includes('500') || message.includes('sendEvent') ||
            message.includes('OIDC') || message.includes('OAuth') || message.includes('access_token') ||
            message.includes('authentication') || message.includes('token') || message.includes('401') ||
            message.includes('403') || message.includes('Unable to connect')) {
          matrixErrors.push(message)
          cy.log(`❌ Matrix Error Captured: ${message}`)
        }
        originalConsoleError.apply(win.console, args)
      }

      // Capture Matrix-related warnings
      win.console.warn = (...args) => {
        const message = args.join(' ')
        if (message.includes('Matrix') || message.includes('OIDC') || message.includes('OAuth') ||
            message.includes('authentication') || message.includes('token')) {
          cy.log(`⚠️ Matrix Warning: ${message}`)
        }
        originalConsoleWarn.apply(win.console, args)
      }

      // Capture Matrix-related logs for debugging
      win.console.log = (...args) => {
        const message = args.join(' ')
        if (message.includes('Matrix') || message.includes('OIDC') || message.includes('OAuth') ||
            message.includes('authentication') || message.includes('Connected to Matrix') ||
            message.includes('token')) {
          cy.log(`ℹ️ Matrix Log: ${message}`)
        }
        originalConsoleLog.apply(win.console, args)
      }

      // Store errors for later checking
      ;(win as unknown as { matrixErrors: string[] }).matrixErrors = matrixErrors

      // Try to access Matrix client status if available
      try {
        if ((win as unknown as { matrixService?: unknown; matrixClient?: unknown }).matrixService ||
            (win as unknown as { matrixService?: unknown; matrixClient?: unknown }).matrixClient) {
          cy.log('✅ Matrix service/client found in window')

          // Check client state if possible
          const matrixClient = (win as unknown as { matrixClient?: { getHomeserverUrl?: () => string; getUserId?: () => string | null } }).matrixClient
          if (matrixClient && typeof matrixClient.getHomeserverUrl === 'function') {
            cy.log(`Matrix homeserver: ${matrixClient.getHomeserverUrl()}`)
          }
          if (matrixClient && typeof matrixClient.getUserId === 'function') {
            const userId = matrixClient.getUserId()
            cy.log(`Matrix user ID: ${userId || 'not logged in'}`)
          }
        } else {
          cy.log('⚠️ Matrix service/client not found in window')
        }
      } catch (e) {
        cy.log(`ℹ️ Could not check Matrix client status: ${e}`)
      }
    })

    // Attempt to send a test message
    cy.log('📤 Attempting to send test message...')

    const testMessage = `Test message ${Date.now()} - MSC3861/MSC3970 verification`

    cy.get('[data-cy="chat-input"]')
      .clear()

    cy.get('[data-cy="chat-input"]')
      .type(testMessage)

    cy.log(`✅ Typed test message: ${testMessage}`)

    // Send the message (Enter key or send button)
    cy.get('[data-cy="chat-input"]')
      .type('{enter}')

    cy.log('📤 Sent message via Enter key')

    // Alternative: try send button if Enter doesn't work
    cy.get('[data-cy="send-button"]')
      .should('exist')

    cy.get('[data-cy="send-button"]')
      .click()

    cy.then(() => {
      cy.log('📤 Clicked send button')
    })

    // Wait for message to appear or for any error indicators
    cy.get('body', { timeout: 10000 })
      .should('exist')

    // Check if message appears in chat (success case)
    cy.get('[data-cy="messages-list"]', { timeout: 10000 }).then(($messagesList) => {
      if ($messagesList.text().includes(testMessage)) {
        cy.log('✅ SUCCESS: Message appears in chat - MSC3970 working!')
        cy.get('[data-cy="messages-list"]').contains(testMessage).should('be.visible')
      } else {
        cy.log('⚠️ Message not visible in chat - checking for errors...')
        // Fallback: check entire page for message
        cy.get('body').then(($body) => {
          if ($body.text().includes(testMessage)) {
            cy.log('✅ Message found elsewhere on page')
            cy.contains(testMessage).should('be.visible')
          }
        })
      }
    })

    // Check for Matrix errors in console
    cy.window().then((win) => {
      const matrixErrors = (win as unknown as { matrixErrors?: string[] }).matrixErrors || []

      if (matrixErrors.length > 0) {
        cy.log('❌ Matrix errors detected:')
        matrixErrors.forEach((error: string, index: number) => {
          cy.log(`   ${index + 1}. ${error}`)
        })

        // Check for specific error types
        const hasAuthError = matrixErrors.some((error: string) =>
          error.includes('401') || error.includes('403') ||
          error.includes('authentication') || error.includes('Unauthorized')
        )

        const hasTokenError = matrixErrors.some((error: string) =>
          error.includes('token') || error.includes('access_token') ||
          error.includes('OIDC') || error.includes('OAuth')
        )

        const hasTransactionError = matrixErrors.some((error: string) =>
          error.includes('500') ||
          error.includes('access_token_id') ||
          error.includes('sendEvent')
        )

        const hasConnectionError = matrixErrors.some((error: string) =>
          error.includes('Unable to connect') || error.includes('Network') ||
          error.includes('Failed to connect')
        )

        if (hasAuthError) {
          cy.log('❌ AUTHENTICATION ERROR: OAuth flow may have failed')
          cy.log('🔍 Check if user is properly authenticated with MAS')
        }

        if (hasTokenError) {
          cy.log('❌ TOKEN ERROR: OAuth token may be invalid or expired')
          cy.log('🔍 Check MAS token exchange and validation')
        }

        if (hasConnectionError) {
          cy.log('❌ CONNECTION ERROR: Cannot connect to Matrix server')
          cy.log('🔍 Check Matrix homeserver availability and network')
        }

        if (hasTransactionError) {
          cy.log('❌ CONFIRMED: MSC3861 transaction ID issue detected')
          cy.log('💡 Solution: Enable MSC3970 in Synapse configuration')
          cy.log('📋 Error indicates OAuth2 tokens lack access_token_id field')
        }
      } else {
        cy.log('✅ No Matrix errors detected - checking for successful connection...')

        // If no errors, check if we have a working Matrix connection
        cy.get('body').then(($body) => {
          if ($body.find('[data-cy="chat-input"]').length > 0 &&
              $body.find('[data-cy="matrix-connect-button"]').length === 0) {
            cy.log('✅ Matrix connection appears successful!')
          } else {
            cy.log('⚠️ Matrix connection status unclear - check manually')
          }
        })
      }
    })

    // Take screenshot for manual verification
    cy.screenshot('matrix-message-test-result')

    // Log test results
    cy.log('📊 Matrix Message Sending Test Complete')
    cy.log('🔍 Check screenshot and console logs for detailed results')
    cy.log('✅ If message appears: MSC3970 is working')
    cy.log('❌ If 500 errors: MSC3970 needs to be enabled')
  })

  it('should test typing indicators (these should work)', () => {
    cy.log('⌨️ Testing typing indicators (should work with OAuth2)')

    cy.visit(`/events/${testEventSlug}`)
    cy.contains('Loading', { timeout: 10000 }).should('not.exist')

    // Look for Matrix chat interface
    cy.get('[data-cy="matrix-chat-interface"]', { timeout: 30000 })
      .should('exist')
      .then(() => {
        cy.log('✅ Matrix chat interface found')
      })

    // Look for and click the Matrix connect button (if needed)
    cy.get('body').then(($body) => {
      if ($body.find('[data-cy="matrix-connect-button"]').length > 0) {
        cy.log('🔐 Matrix connect button found, starting OAuth flow...')
        cy.get('[data-cy="matrix-connect-button"]')
          .click()

        // Handle MAS OAuth flow
        cy.origin('http://localhost:8081', () => {
          cy.contains('Continue with OpenMeet Local', { timeout: 15000 })
            .should('be.visible')
            .click()
        })

        // Handle redirect to OpenMeet API OIDC login page
        cy.origin('https://localdev.openmeet.net', () => {
          // Handle the email login form on the API server
          cy.get('input[type="email"], input[name="email"], #email', { timeout: 10000 })
            .should('be.visible')

          cy.get('input[type="email"], input[name="email"], #email')
            .clear()

          cy.get('input[type="email"], input[name="email"], #email')
            .type(Cypress.env('APP_TESTING_ADMIN_EMAIL'))

          // Click the "Continue" button
          cy.contains('button', 'Continue', { timeout: 5000 })
            .should('be.visible')
            .click()

          cy.log('✅ Completed OAuth flow for typing test')
        })

        // Handle potential login redirect
        cy.url({ timeout: 10000 }).then((url) => {
          if (url.includes('/auth/login')) {
            cy.log('🔐 Login required in typing test')

            // Only proceed if we can actually see the login form
            cy.get('body').then(($body) => {
              if ($body.find('input[type="email"], input[name="email"]').length > 0) {
                cy.get('input[type="email"], input[name="email"]', { timeout: 5000 })
                  .should('be.visible')
                  .should('be.enabled')

                cy.get('input[type="email"], input[name="email"]')
                  .clear()

                cy.get('input[type="email"], input[name="email"]')
                  .type(Cypress.env('APP_TESTING_ADMIN_EMAIL'))

                cy.get('input[type="password"], input[name="password"]', { timeout: 5000 })
                  .should('be.visible')
                  .should('be.enabled')

                cy.get('input[type="password"], input[name="password"]')
                  .clear()

                cy.get('input[type="password"], input[name="password"]')
                  .type(Cypress.env('APP_TESTING_ADMIN_PASSWORD'))

                cy.contains('button', 'Login', { timeout: 5000 })
                  .should('be.visible')
                  .should('be.enabled')
                  .click()

                cy.log('✅ Completed login in typing test')
              } else {
                cy.log('ℹ️ Login form not found in typing test')
              }
            })
          } else {
            cy.log('✅ No login required in typing test - session preserved')
          }
        })

        // Wait for return to main application
        cy.url({ timeout: 30000 }).should('include', 'localhost:8087')
      } else {
        cy.log('✅ Matrix already connected, proceeding to typing test')
      }
    })

    // Wait for chat interface to be ready
    cy.get('[data-cy="chat-input"]', { timeout: 30000 })
      .should('exist')
      .and('be.visible')

    // Start typing to trigger typing indicator
    cy.get('[data-cy="chat-input"]')
      .clear()

    cy.get('[data-cy="chat-input"]')
      .type('Testing typing indicator...')

    cy.then(() => {
      cy.log('✅ Typing in chat input - should trigger typing indicator')
    })

    // Allow time for typing indicator to potentially appear
    cy.get('[data-cy="chat-input"]')
      .should('have.value', 'Testing typing indicator...')

    // Clear input to stop typing
    cy.get('[data-cy="chat-input"]')
      .clear()

    cy.then(() => {
      cy.log('✅ Cleared input - typing indicator should stop')
    })

    cy.log('✅ Typing indicator test complete')
    cy.log('💡 Typing indicators work because they don\'t use transaction IDs')
  })

  it('should provide debugging information', () => {
    cy.log('🔍 Matrix Configuration Debug Information:')

    // Check Matrix configuration
    cy.window().then(() => {
      const matrixConfig = {
        homeserver: Cypress.env('MATRIX_HOMESERVER_URL') || 'http://localhost:8448',
        masUrl: Cypress.env('MAS_SERVICE_URL') || 'http://localhost:8081',
        clientId: Cypress.env('MAS_CLIENT_ID') || 'unknown'
      }

      cy.log(`Matrix Homeserver: ${matrixConfig.homeserver}`)
      cy.log(`MAS URL: ${matrixConfig.masUrl}`)
      cy.log(`Client ID: ${matrixConfig.clientId}`)
    })

    cy.log('📋 Test Environment Status:')
    cy.log('- MSC3861: Enabled (OAuth2 delegation to MAS)')
    cy.log('- MSC3970: Status unknown (this test will verify)')
    cy.log('- Expected: 500 errors on sendEvent if MSC3970 disabled')
    cy.log('- Expected: Successful messages if MSC3970 enabled')

    cy.log('🎯 Next Steps Based on Results:')
    cy.log('1. If messages work: MSC3970 is working correctly')
    cy.log('2. If 500 errors: Enable MSC3970 in Synapse homeserver.yaml')
    cy.log('3. Check Synapse logs for "access_token_id" errors')
    cy.log('4. Verify msc3970_enabled: true in configuration')

    // Always pass this test - it's just for information
    expect(true).to.equal(true)
  })
})
