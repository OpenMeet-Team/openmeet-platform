/**
 * Simple test to verify auth fix works
 */

describe('Authentication Test', () => {
  const testUser = {
    email: 'openmeet-test.auth-fix@openmeet.net',
    password: 'Test123!@#',
    firstName: 'Auth',
    lastName: 'Test'
  }

  it('should register and login successfully', () => {
    // Ensure user exists with fixed tenant config
    cy.ensureUserExists(testUser)

    // Monitor the login request
    cy.intercept('POST', '**/api/v1/auth/email/login').as('loginRequest')

    // Monitor console logs from the frontend
    cy.visit('/auth/login')
    cy.window().then((win) => {
      const originalLog = win.console.log
      win.console.log = (...args) => {
        cy.task('log', `FRONTEND LOG: ${args.join(' ')}`)
        originalLog.apply(win.console, args)
      }
    })

    cy.dataCy('login-email').type(testUser.email)
    cy.dataCy('login-password').type(testUser.password)
    cy.dataCy('login-submit').click()

    // Wait for login request and check response
    cy.wait('@loginRequest').then((interception) => {
      cy.task('log', `Login status: ${interception.response?.statusCode}`)
      if (interception.response?.statusCode !== 200) {
        cy.task('log', `Login failed: ${JSON.stringify(interception.response?.body, null, 2)}`)
      } else {
        cy.task('log', 'Login API successful - checking for redirect')
      }
    })

    // Should redirect to home page
    cy.url({ timeout: 10000 }).should('eq', Cypress.config('baseUrl'))

    // Should show profile avatar
    cy.dataCy('header-profile-avatar').should('be.visible')

    cy.task('log', 'SUCCESS: Authentication working correctly!')
  })
})