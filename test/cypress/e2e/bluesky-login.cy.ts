/// <reference types="cypress" />

// interface AuthWindow extends Window {
//   __authorizeData: {
//     clientId: string,
//     clientMetadata: Record<string, unknown>,
//     clientTrusted: boolean,
//     requestUri: string,
//     csrfCookie: string,
//     loginHint: string,
//     newSessionsRequireConsent: boolean,
//     scopeDetails: Array<{scope: string}>,
//     sessions: unknown[]
//   }
// }

describe('Bluesky Login Flow', () => {
  beforeEach(() => {
    // Reset application state before each test
    cy.clearCookies()
    cy.clearLocalStorage()

    // Visit the login page
    cy.visit('/auth/login')
  })

  it('should successfully login using Bluesky', () => {
    // Use the authenticateWithBluesky command to handle the entire authentication flow
    cy.authenticateWithBluesky()

    // Verify we're on the home page
    cy.url({ timeout: 5000 }).should('match', /^https?:\/\/[^/]+\/?$/)

    // Verify user data is loaded correctly
    cy.window().then(win => {
      // Check for user data in localStorage
      const userDataRaw = win.localStorage.getItem('user')
      cy.wrap(userDataRaw).should('not.be.null')

      // Check for auth token
      const authTokenRaw = win.localStorage.getItem('token')
      cy.wrap(authTokenRaw).should('not.be.null')
    })
  })

  // it('should handle email collection if needed', () => {
  //   // Similar flow but simulate needsEmail response
  //   // ... previous steps same as above until callback

  //   cy.window().then((win) => {
  //     win.postMessage({ needsEmail: true }, win.location.origin)
  //   })

  //   cy.url().should('include', '/auth/collect-email')
  // })
})
