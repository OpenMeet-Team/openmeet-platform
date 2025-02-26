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
    cy.visit('/auth/login')
  })

  it('should successfully login using Bluesky', () => {
    // Stub window.open before any interactions
    cy.window().then((win) => {
      cy.stub(win, 'open').as('windowOpen')
    })

    // Intercept the authorize API call first
    cy.intercept('GET', '**/api/v1/auth/bluesky/authorize*').as('authorizeRequest')

    // Click Bluesky login button
    cy.dataCy('bluesky-login-button').click()

    // Handle the login dialog
    cy.get('.q-dialog').within(() => {
      cy.get('input[type="text"]').type(Cypress.env('APP_TESTING_BLUESKY_HANDLE'))
      cy.contains('button', 'OK').click()
    })

    // Wait for and parse the intercepted request to backend authorize endpoint
    cy.wait('@authorizeRequest').then((interception) => {
      const url = new URL(interception.request.url)
      const tenantId = url.searchParams.get('tenantId')
      url.searchParams.forEach((value, key) => {
        cy.log('Param:', key, value)
      })

      let csrfToken: string | undefined

      // Set up OAuth intercepts before making the request
      cy.intercept('GET', '**/bsky.social/oauth/authorize*', (req) => {
        req.headers['sec-fetch-mode'] = 'navigate'
        req.headers['sec-fetch-dest'] = 'document'
        req.headers['sec-fetch-site'] = 'none'

        // Capture the CSRF token from the response
        req.on('response', (res) => {
          const bodyStr = res.body as string
          cy.log('OAuth page response:', bodyStr)

          // Look for the CSRF token in the response HTML
          const csrfInputMatch = bodyStr.match(/<input[^>]*name="csrf"[^>]*value="([^"]+)"/)
          if (csrfInputMatch) {
            try {
              csrfToken = csrfInputMatch[1]
              cy.log('Found CSRF token from input:', csrfToken)

              if (!csrfToken) {
                throw new Error('CSRF token is empty')
              }
            } catch (error) {
              cy.log('Error processing CSRF token:', error)
              throw error // Re-throw to fail the test
            }
          } else {
            // Fallback to looking in __authorizeData if not found in input
            const authDataMatch = bodyStr.match(/window\["__authorizeData"\]=({[^<]+})/)
            if (authDataMatch) {
              try {
                const authorizeData = JSON.parse(authDataMatch[1])
                csrfToken = authorizeData.csrfCookie
                cy.log('Found CSRF token from authorizeData:', csrfToken)

                if (!csrfToken) {
                  throw new Error('CSRF token is empty')
                }
              } catch (error) {
                cy.log('Error processing authorizeData CSRF token:', error)
                throw error
              }
            } else {
              throw new Error('No CSRF token found in response')
            }
          }
        })
      }).as('initialOAuth')

      // Handle the sign-in request
      cy.intercept('POST', '**/bsky.social/oauth/authorize/sign-in', (req) => {
        if (!csrfToken) {
          throw new Error('No CSRF token found in OAuth page')
        }

        req.headers = {
          ...req.headers,
          'x-csrf-token': csrfToken,
          'sec-fetch-mode': 'same-origin',
          'sec-fetch-site': 'same-origin',
          'sec-fetch-dest': 'empty',
          'content-type': 'application/json',
          accept: 'application/json'
        }

        req.body = {
          csrf_token: csrfToken,
          username: Cypress.env('APP_TESTING_BLUESKY_HANDLE'),
          password: Cypress.env('APP_TESTING_BLUESKY_PASSWORD')
        }

        cy.log('Sign-in request headers:', JSON.stringify(req.headers))
        cy.log('Sign-in request body:', JSON.stringify(req.body))
      }).as('signInRequest')

      cy.request({
        url: `${Cypress.env('APP_TESTING_API_URL')}/api/v1/auth/bluesky/authorize?handle=${Cypress.env('APP_TESTING_BLUESKY_HANDLE')}&tenantId=${tenantId}`,
        headers: {
          Accept: 'text/plain'
        }
      }).then((response) => {
        const authUrl = response.body
        const authOrigin = new URL(authUrl).origin

        // Set up all intercepts before cy.origin
        cy.intercept('POST', '**/oauth/authorize/sign-in').as('signIn')
        cy.intercept('GET', '**/oauth/authorize/decide').as('decide')
        cy.intercept('GET', '**/auth/bluesky/callback**').as('callback')

        cy.origin(authOrigin, { args: { authUrl, password: Cypress.env('APP_TESTING_BLUESKY_PASSWORD') } },
          ({ authUrl, password }) => {
            cy.visit(authUrl)

            // Wait for initial OAuth page to load
            cy.get('input[type="password"]', { timeout: 4000 }).should('be.visible')
            cy.get('input[type="password"]').type(password)
            cy.get('form button[type="submit"]').click()
          }
        )

        // Wait for all redirects to complete
        cy.wait('@callback', { timeout: 3000 })

        // Check final URL
        cy.url().should('include', '/dashboard', { timeout: 5000 })
      })
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
