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

  it('should login successfully using the working login command', () => {
    // Ensure user exists with fixed tenant config
    cy.ensureUserExists(testUser)

    // Use the existing working login command that we know works
    cy.login(testUser.email, testUser.password)

    // Verify we're on the home page and authenticated
    cy.url().should('eq', Cypress.config('baseUrl'))
    cy.dataCy('header-profile-avatar').should('be.visible')

    cy.task('log', 'SUCCESS: Authentication working correctly!')
  })
})
