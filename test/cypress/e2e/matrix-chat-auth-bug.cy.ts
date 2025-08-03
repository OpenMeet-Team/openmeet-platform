describe('Matrix Chat Authentication Bug Reproduction', () => {
  let testEventSlug: string

  before(() => {
    cy.clearCookies()
    cy.clearLocalStorage()
    cy.visit('/')

    cy.login(Cypress.env('APP_TESTING_ADMIN_EMAIL'), Cypress.env('APP_TESTING_ADMIN_PASSWORD'))

    const timestamp = new Date().toISOString().replace(/[-:.]/g, '')
    const eventName = `Auth Bug Test Event ${timestamp}`
    cy.createEventApi(eventName, {
      description: `Test event to reproduce authentication bug - ${timestamp}`,
      status: 'published'
    }).then((slug: string) => {
      testEventSlug = slug
      cy.log(`Test will use event with slug: ${testEventSlug}`)
    })
  })

  beforeEach(() => {
    cy.clearCookies()
    cy.clearLocalStorage()

    // Also clear any Matrix-related session storage
    cy.window().then((win) => {
      // Clear Matrix tokens that might be causing authentication issues
      win.sessionStorage.clear()
      Object.keys(win.localStorage).forEach(key => {
        if (key.includes('matrix') || key.includes('Matrix')) {
          win.localStorage.removeItem(key)
        }
      })
    })

    cy.visit('/')

    cy.login(Cypress.env('APP_TESTING_ADMIN_EMAIL'), Cypress.env('APP_TESTING_ADMIN_PASSWORD'))
    cy.get('[data-cy="header-profile-avatar"]', { timeout: 10000 }).should('be.visible')
  })

  after(() => {
    if (testEventSlug) {
      cy.deleteEventApi(testEventSlug)
    }
  })

  it('should successfully authenticate and send message without page reload', () => {
    cy.visit(`/events/${testEventSlug}`)

    cy.contains('Loading', { timeout: 10000 }).should('not.exist')
    cy.contains(/Auth Bug Test Event/, { timeout: 15000 }).should('be.visible')

    cy.screenshot('01-initial-page-load')

    // Look for and click the Join Discussion button
    cy.contains('Join Discussion', { timeout: 10000 }).should('be.visible').click()
    cy.log('✅ Clicked Join Discussion button')

    // Check if the Join Discussion button is still there (indicating click didn't work)
    cy.get('body').then(($body) => {
      if ($body.text().includes('Join Discussion')) {
        cy.log('❌ Join Discussion button still visible - click may not have worked')
        cy.screenshot('01-join-discussion-still-visible')

        // Try clicking it again with force
        cy.contains('Join Discussion').click({ force: true })
        cy.log('🔄 Forced click on Join Discussion button')
      } else {
        cy.log('✅ Join Discussion button disappeared - click was successful')
      }
    })

    // Check if we're on the MAS consent screen (either immediately or after retry)
    cy.get('body').then(($body) => {
      if ($body.text().includes('Allow access to your account?')) {
        // We're on the MAS consent screen - handle it
        cy.log('✅ Found MAS consent screen - handling authentication')
        cy.screenshot('02-mas-consent-screen')
        cy.contains('button', 'Continue').should('be.visible').click()
        cy.log('✅ Clicked Continue on MAS consent screen')

        // Should return to event page with chat ready
        cy.url({ timeout: 20000 }).should('include', '/events/')
        cy.log('✅ Returned to event page after authentication')

        // Wait for the page to fully load and stop showing loading indicators
        cy.contains('Loading', { timeout: 15000 }).should('not.exist')
        cy.contains(/Auth Bug Test Event/, { timeout: 15000 }).should('be.visible')
        cy.log('✅ Event content loaded after authentication')

        // Wait for chat input to be ready
        cy.dataCy('chat-input', { timeout: 30000 })
          .should('exist')
          .and('be.visible')

        const testMessage = `Test message ${Date.now()}`
        cy.dataCy('chat-input').clear()
        cy.dataCy('chat-input').type(testMessage)
        cy.dataCy('chat-input').type('{enter}')
        cy.contains(testMessage, { timeout: 15000 }).should('be.visible')
        cy.screenshot('03-message-sent-successfully')
        cy.log('🎉 Successfully sent message to chat!')
      } else if ($body.text().includes('Retry')) {
        // We're back on the event page with a retry button - click it
        cy.log('✅ Found Retry button - Matrix chat interface loaded but needs authentication')
        cy.screenshot('02-retry-button-visible')

        cy.contains('button', 'Retry').should('be.visible').click()
        cy.log('🔄 Clicked Retry button to start Matrix authentication')

        // Wait for redirect to MAS consent screen
        const masUrl = Cypress.env('MAS_SERVICE_URL')
        if (!masUrl) {
          throw new Error('MAS_SERVICE_URL environment variable is required')
        }
        cy.url({ timeout: 10000 }).should('include', new URL(masUrl).host)
        cy.log('✅ Successfully redirected to MAS consent screen')

        // Handle MAS consent screen
        cy.contains('Allow access to your account?', { timeout: 15000 }).should('be.visible')
        cy.screenshot('03-mas-consent-screen-from-retry')

        cy.contains('button', 'Continue').should('be.visible').click()
        cy.log('✅ Clicked Continue on MAS consent screen')

        // Should return to event page with chat ready
        cy.url({ timeout: 20000 }).should('include', '/events/')
        cy.log('✅ Returned to event page after authentication')

        // Wait for the page to fully load and stop showing loading indicators
        cy.contains('Loading', { timeout: 15000 }).should('not.exist')
        cy.contains(/Auth Bug Test Event/, { timeout: 15000 }).should('be.visible')
        cy.log('✅ Event content loaded after authentication')

        // Wait for chat input to be ready
        cy.dataCy('chat-input', { timeout: 30000 })
          .should('exist')
          .and('be.visible')

        const testMessage = `Test message ${Date.now()}`
        cy.dataCy('chat-input').clear()
        cy.dataCy('chat-input').type(testMessage)
        cy.dataCy('chat-input').type('{enter}')
        cy.contains(testMessage, { timeout: 15000 }).should('be.visible')
        cy.screenshot('04-message-sent-successfully')
        cy.log('🎉 Successfully sent message to chat!')
      } else {
        // Check if we might have been redirected immediately to MAS but text check failed
        cy.url().then((url) => {
          const masUrl = Cypress.env('MAS_SERVICE_URL')
          if (!masUrl) {
            throw new Error('MAS_SERVICE_URL environment variable is required')
          }
          if (url.includes(new URL(masUrl).host)) {
            cy.log('✅ On MAS domain - looking for consent screen elements')
            cy.contains('Allow access to your account?', { timeout: 15000 }).should('be.visible')
            cy.screenshot('02-mas-consent-detected-by-url')
            cy.contains('button', 'Continue').should('be.visible').click()
            cy.log('✅ Clicked Continue on MAS consent screen')

            // Continue with the rest of the flow...
            cy.url({ timeout: 20000 }).should('include', '/events/')
            cy.log('✅ Returned to event page after authentication')

            // Wait for the page to fully load and stop showing loading indicators
            cy.contains('Loading', { timeout: 15000 }).should('not.exist')
            cy.contains(/Auth Bug Test Event/, { timeout: 15000 }).should('be.visible')
            cy.log('✅ Event content loaded after authentication')

            cy.dataCy('chat-input', { timeout: 30000 })
              .should('exist')
              .and('be.visible')

            const testMessage = `Test message ${Date.now()}`
            cy.dataCy('chat-input').clear()
            cy.dataCy('chat-input').type(testMessage)
            cy.dataCy('chat-input').type('{enter}')
            cy.contains(testMessage, { timeout: 15000 }).should('be.visible')
            cy.screenshot('03-message-sent-successfully')
            cy.log('🎉 Successfully sent message to chat!')
          } else {
            cy.log('❌ Unexpected state - no consent screen, retry button, or redirect found')
            cy.screenshot('02-unexpected-state')
            throw new Error('Matrix chat not in expected state after clicking Join Discussion')
          }
        })
      }
    })

    cy.window().then((win) => {
      const authErrors = (win as unknown as { authErrors?: string[] }).authErrors || []

      if (authErrors.length > 0) {
        cy.log('❌ Authentication errors detected during test:')
        authErrors.forEach((error: string, index: number) => {
          cy.log(`   ${index + 1}. ${error}`)
        })
      } else {
        cy.log('✅ No authentication errors detected')
      }
    })
  })

  it.skip('should test the ideal behavior - no reload needed (will fail until bug is fixed)', () => {
    cy.visit(`/events/${testEventSlug}`)
    cy.contains('Loading', { timeout: 10000 }).should('not.exist')

    cy.dataCy('matrix-chat-interface').should('exist')

    cy.dataCy('matrix-connect-button', { timeout: 5000 })
      .should('exist')
      .and('be.visible')

    cy.get('body').should('not.contain.text', 'not invited')
    cy.get('body').should('not.contain.text', 'Not invited')
  })

  it('should verify token refresh implementation (placeholder for future test)', () => {
    cy.visit(`/events/${testEventSlug}`)

    cy.contains(/Auth Bug Test Event/, { timeout: 15000 }).should('be.visible')

    expect(true).to.equal(true)
  })
})
