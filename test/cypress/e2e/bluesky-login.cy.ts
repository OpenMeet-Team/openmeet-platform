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

    let csrfToken: string | undefined
    let authorizeData: {
      clientId: string,
      clientMetadata: Record<string, unknown>,
      clientTrusted: boolean,
      requestUri: string,
      csrfCookie: string,
      loginHint: string,
      newSessionsRequireConsent: boolean,
      scopeDetails: Array<{scope: string}>,
      sessions: unknown[]
    }

    // Common security headers
    const commonHeaders = {
      'sec-fetch-mode': 'navigate',
      'sec-fetch-dest': 'document',
      'sec-fetch-site': 'none',
      'upgrade-insecure-requests': '1'
    }

    // First capture the CSRF token and authorize data
    cy.intercept('GET', '**/bsky.social/oauth/authorize*', (req) => {
      req.on('response', (res) => {
        const cookies = Array.isArray(res.headers['set-cookie']) ? res.headers['set-cookie'] : [res.headers['set-cookie']]
        const csrfCookie = cookies.find(c => c?.startsWith('csrf-'))
        csrfToken = csrfCookie?.split(';')[0]?.split('=')[1]

        // Capture window.__authorizeData
        const bodyStr = res.body as string
        const match = bodyStr.match(/window\.__authorizeData\s*=\s*({[^;]+});/)
        if (match) {
          authorizeData = JSON.parse(match[1])
        }

        // Now that we have the token, set up the sign-in intercept
        cy.intercept('POST', '**/bsky.social/oauth/authorize/sign-in', (req) => {
          req.headers['x-csrf-token'] = csrfToken
          req.headers['sec-fetch-mode'] = 'same-origin'
          req.headers['sec-fetch-site'] = 'same-origin'
          req.headers['content-type'] = 'application/json'

          req.body = {
            csrf_token: csrfToken,
            password: Cypress.env('APP_TESTING_BLUESKY_PASSWORD'),
            requestUri: authorizeData.requestUri
          }
          cy.log('Sign-in request headers:', req.headers)
          cy.log('Sign-in request body:', req.body)
        }).as('signInRequest')
      })
    }).as('initialOAuth')

    // Add common headers to all OAuth requests
    cy.intercept({ url: '**/bsky.social/oauth/**', middleware: true }, (req) => {
      Object.assign(req.headers, commonHeaders)
    }).as('bskyRequests')

    // Intercept the authorize API call
    cy.intercept('GET', '**/api/v1/auth/bluesky/authorize*').as('authorizeRequest')

    // Click Bluesky login button
    cy.dataCy('bluesky-login-button').click()

    // Handle the login dialog
    cy.get('.q-dialog').within(() => {
      cy.get('input[type="text"]').type(Cypress.env('APP_TESTING_BLUESKY_HANDLE'))
      cy.contains('button', 'OK').click()
    })

    // Wait for and parse the intercepted request
    cy.wait('@authorizeRequest').then((interception) => {
      const url = new URL(interception.request.url)
      const tenantId = url.searchParams.get('tenantId')

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

            // Wait for the page to load and form to be ready
            cy.get('input[type="password"]', { timeout: 4000 }).should('be.visible')
            cy.get('input[type="password"]').type(password)
            cy.get('form button[type="submit"]').click()

            // Handle the authorization page if it appears
            cy.get('body').then($body => {
              if ($body.find('button:contains("Authorize")').length > 0) {
                cy.get('button:contains("Authorize")').click()
              }
            })
          }
        )

        // Wait for all redirects to complete
        cy.wait('@callback', { timeout: 3000 })
        // cy.wait(1000) // Small delay for client-side processing

        // Check final URL
        cy.url().should('include', '/dashboard', { timeout: 3000 })
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
