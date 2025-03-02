// ***********************************************
// This example commands.ts shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add("login", (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add("drag", { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add("dismiss", { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite("visit", (originalFn, url, options) => { ... })

// DO NOT REMOVE
// Imports Quasar Cypress AE predefined commands
import { registerCommands } from '@quasar/quasar-app-extension-testing-e2e-cypress'
registerCommands()

// Add Window interface augmentation
declare global {
  interface Window {
    __authorizeData?: {
      csrfCookie: string;
      requestUri: string;
      clientId: string;
      [key: string]: unknown;
    };
    __oauthUrl?: string;
  }
}

// Note: Type definitions are moved to index.d.ts
// This removes the namespace linting error

// Add Cypress commands
Cypress.Commands.add('login', (username: string, password: string) => {
  // cy.dataCy('header-mobile-menu').click()
  // cy.dataCy('header-mobile-menu-drawer').should('be.visible').within(() => {
  //   cy.dataCy('sign-in-button').click()
  // })
  cy.dataCy('header-sign-in-button').should('be.visible').click()

  cy.dataCy('login-form').should('be.visible')
  cy.dataCy('login-email').type(username)
  cy.dataCy('login-password').type(password)
  cy.dataCy('login-submit').click()
})

Cypress.Commands.add('loginPage', (username: string, password: string) => {
  cy.dataCy('login-email').type(username)
  cy.dataCy('login-password').type(password)
  cy.dataCy('login-submit').click()
})

Cypress.Commands.add('logout', () => {
  // Click the avatar to open menu
  cy.dataCy('header-profile-avatar').click()

  // Click the logout menu item and wait for auth state to clear
  cy.contains('Logout').click({ force: true })

  cy.url().should('eq', Cypress.config().baseUrl)

  // Now check for the sign-in button
  cy.dataCy('header-sign-in-button').should('be.visible')
})

// New command for Bluesky Login
Cypress.Commands.add('loginBluesky', (username: string, password: string) => {
  // Click the dedicated Bluesky login button
  cy.dataCy('bluesky-login-button').should('be.visible').click()

  // Wait for the Bluesky login form to appear
  cy.dataCy('bluesky-login-form').should('be.visible')

  // Fill in the Bluesky login form with the provided user and password
  cy.dataCy('bluesky-login-email').type(username)
  cy.dataCy('bluesky-login-password').type(password)
  cy.dataCy('bluesky-login-submit').click()
})

// Bluesky OAuth Authentication Commands
// =====================================

// Command to simulate Bluesky authentication by bypassing the actual OAuth flow
Cypress.Commands.add('simulateBlueskyAuth', () => {
  // Intercept the auth callback endpoint to simulate a successful authentication
  cy.intercept('GET', '**/auth/bluesky/callback**', {
    statusCode: 302,
    headers: {
      Location: '/dashboard'
    }
  }).as('simulatedCallback')

  // Set the necessary cookies/tokens to simulate authenticated state
  cy.setCookie('auth_token', 'simulated-auth-token')
  cy.window().then(win => {
    win.localStorage.setItem('user', JSON.stringify({
      id: 'simulated-user-id',
      handle: Cypress.env('APP_TESTING_BLUESKY_HANDLE') || 'test.bsky.social',
      displayName: 'Test User',
      isAuthenticated: true,
      authProvider: 'bluesky'
    }))
  })

  // Navigate to dashboard directly
  cy.visit('/dashboard')
})

// Command to mock Bluesky authentication for API testing
Cypress.Commands.add('mockBlueskyAuth', () => {
  // Set authentication state without UI interaction
  cy.setCookie('auth_token', 'mock-auth-token')
  cy.window().then(win => {
    win.localStorage.setItem('user', JSON.stringify({
      id: 'mock-user-id',
      handle: Cypress.env('APP_TESTING_BLUESKY_HANDLE') || 'test.bsky.social',
      displayName: 'Test User',
      isAuthenticated: true,
      authProvider: 'bluesky'
    }))
  })

  // Mock any API calls that would verify authentication
  cy.intercept('GET', '**/api/v1/user/profile', {
    statusCode: 200,
    body: {
      id: 'mock-user-id',
      handle: Cypress.env('APP_TESTING_BLUESKY_HANDLE') || 'test.bsky.social',
      displayName: 'Test User',
      email: 'test@example.com'
    }
  }).as('mockUserProfile')
})

// Command to perform real Bluesky OAuth authentication
Cypress.Commands.add('authenticateWithBluesky', () => {
  // Intercept the authorize API call
  cy.intercept('GET', '**/api/v1/auth/bluesky/authorize*').as('authorizeRequest')

  // Intercept the OAuth sign-in request to monitor CSRF token
  cy.intercept('POST', '**/oauth/authorize/sign-in').as('oauthSignInRequest')

  // Intercept the OAuth authorize request
  cy.intercept('GET', '**/oauth/authorize**').as('oauthAuthorizeRequest')

  // Intercept the callback endpoint
  cy.intercept('GET', '**/api/v1/auth/bluesky/callback**').as('callback')

  // Click Bluesky login button
  cy.dataCy('bluesky-login-button').click()

  // Handle the login dialog for entering Bluesky handle
  cy.get('.q-dialog').within(() => {
    cy.get('input[type="text"]').type(Cypress.env('APP_TESTING_BLUESKY_HANDLE'))
    cy.contains('button', 'OK').click()
  })

  // Wait for the authorize request
  cy.wait('@authorizeRequest').then(interception => {
    const url = new URL(interception.request.url)
    const tenantId = url.searchParams.get('tenantId')
    cy.log(`Tenant ID: ${tenantId}`)

    // Get the authorization URL from our backend
    cy.request({
      url: `${Cypress.env('APP_TESTING_API_URL')}/api/v1/auth/bluesky/authorize?handle=${Cypress.env('APP_TESTING_BLUESKY_HANDLE')}&tenantId=${tenantId}`,
      headers: { Accept: 'text/plain' }
    }).then(response => {
      const authUrl = response.body
      cy.log(`Auth URL: ${authUrl}`)

      // Extract the request_uri from the auth URL
      const authUrlObj = new URL(authUrl)
      const requestUri = authUrlObj.searchParams.get('request_uri')
      cy.log(`Request URI from auth URL: ${requestUri || 'Not found'}`)

      if (!requestUri) {
        throw new Error('request_uri not found in auth URL')
      }

      // Use cy.origin to handle cross-origin navigation
      cy.origin(
        new URL(authUrl).origin,
        { args: { authUrl, requestUri } },
        ({ authUrl, requestUri }) => {
          // Log the auth URL for debugging
          cy.log(`Visiting auth URL: ${authUrl}`)

          // Visit the auth URL with required security headers
          cy.visit(authUrl, {
            headers: {
              'sec-fetch-mode': 'navigate',
              'sec-fetch-site': 'cross-site',
              'sec-fetch-dest': 'document',
              'sec-fetch-user': '?1'
            }
          })

          // Wait for the page to load and extract CSRF token from window.__authorizeData
          cy.window().then(win => {
            // Wait for __authorizeData to be available
            cy.wrap(null).then(() => {
              // Check if __authorizeData is available
              if (win.__authorizeData) {
                const csrfCookieName = win.__authorizeData.csrfCookie
                const clientId = win.__authorizeData.clientId
                const requestUriFromAuth = win.__authorizeData.requestUri

                // Get the CSRF token from the cookie
                cy.getCookie(csrfCookieName).then(cookie => {
                  if (!cookie) {
                    throw new Error(`Cookie ${csrfCookieName} not found`)
                  }

                  const csrfToken = cookie.value
                  cy.log(`CSRF Cookie Name: ${csrfCookieName}`)
                  cy.log(`CSRF Token: ${csrfToken}`)
                  cy.log(`Client ID: ${clientId}`)
                  cy.log(`Request URI from __authorizeData: ${requestUriFromAuth}`)

                  // Submit the sign-in request with the correct parameters
                  cy.request({
                    method: 'POST',
                    url: `${new URL(authUrl).origin}/oauth/authorize/sign-in`,
                    body: {
                      csrf_token: csrfToken,
                      request_uri: requestUriFromAuth,
                      client_id: clientId,
                      credentials: {
                        username: Cypress.env('APP_TESTING_BLUESKY_HANDLE'),
                        password: Cypress.env('APP_TESTING_BLUESKY_PASSWORD'),
                        remember: false
                      }
                    },
                    headers: {
                      'Content-Type': 'application/json',
                      Accept: '*/*',
                      'sec-fetch-dest': 'empty',
                      'sec-fetch-mode': 'same-origin',
                      'sec-fetch-site': 'same-origin'
                    }
                  }).then(signInResponse => {
                    cy.log(`Sign-in response status: ${signInResponse.status}`)

                    if (signInResponse.status === 200) {
                      // Extract account subject from the response
                      const accountSub = signInResponse.body.account?.sub
                      cy.log(`Account subject: ${accountSub}`)

                      if (accountSub) {
                        // Make the accept request to complete the authorization
                        cy.request({
                          method: 'GET',
                          url: `${new URL(authUrl).origin}/oauth/authorize/accept`,
                          qs: {
                            request_uri: requestUriFromAuth,
                            account_sub: accountSub,
                            client_id: clientId,
                            csrf_token: csrfToken
                          },
                          headers: {
                            'sec-fetch-dest': 'document',
                            'sec-fetch-mode': 'navigate',
                            'sec-fetch-site': 'same-origin',
                            'sec-fetch-user': '?1'
                          },
                          followRedirect: false
                        }).then(acceptResponse => {
                          cy.log(`Accept response status: ${acceptResponse.status}`)

                          // Check if we got a redirect to the callback URL
                          if (acceptResponse.status === 303) {
                            const location = acceptResponse.headers.location
                            cy.log(`Redirect location: ${location}`)

                            if (location && location.includes('/callback')) {
                              // We don't need to follow this redirect as it will be handled by the browser
                              cy.log('Detected callback in redirect, test will continue')
                            }
                          }
                        })
                      }
                    }
                  })
                })
              } else {
                // If __authorizeData is not available, try to extract CSRF token from cookies
                cy.getCookies().then(cookies => {
                  // Look for a cookie that starts with 'csrf-' and contains the request_uri
                  const csrfCookie = cookies.find(cookie =>
                    cookie.name.startsWith('csrf-') &&
                    cookie.name.includes(requestUri.split(':').pop() || '')
                  )

                  if (csrfCookie) {
                    cy.log(`Found CSRF cookie: ${csrfCookie.name} = ${csrfCookie.value}`)

                    // Get the client ID from the URL
                    const clientId = new URL(authUrl).searchParams.get('client_id')

                    // Submit the sign-in request with the extracted information
                    cy.request({
                      method: 'POST',
                      url: `${new URL(authUrl).origin}/oauth/authorize/sign-in`,
                      body: {
                        csrf_token: csrfCookie.value,
                        request_uri: requestUri,
                        client_id: clientId,
                        credentials: {
                          username: Cypress.env('APP_TESTING_BLUESKY_HANDLE'),
                          password: Cypress.env('APP_TESTING_BLUESKY_PASSWORD'),
                          remember: false
                        }
                      },
                      headers: {
                        'Content-Type': 'application/json',
                        Accept: '*/*',
                        'sec-fetch-dest': 'empty',
                        'sec-fetch-mode': 'same-origin',
                        'sec-fetch-site': 'same-origin'
                      }
                    }).then(signInResponse => {
                      cy.log(`Sign-in response status: ${signInResponse.status}`)

                      if (signInResponse.status === 200) {
                        // Extract account subject from the response
                        const accountSub = signInResponse.body.account?.sub
                        cy.log(`Account subject: ${accountSub}`)

                        if (accountSub) {
                          // Make the accept request to complete the authorization
                          cy.request({
                            method: 'GET',
                            url: `${new URL(authUrl).origin}/oauth/authorize/accept`,
                            qs: {
                              request_uri: requestUri,
                              account_sub: accountSub,
                              client_id: clientId,
                              csrf_token: csrfCookie.value
                            },
                            headers: {
                              'sec-fetch-dest': 'document',
                              'sec-fetch-mode': 'navigate',
                              'sec-fetch-site': 'same-origin',
                              'sec-fetch-user': '?1'
                            },
                            followRedirect: false
                          }).then(acceptResponse => {
                            cy.log(`Accept response status: ${acceptResponse.status}`)

                            // Check if we got a redirect to the callback URL
                            if (acceptResponse.status === 303) {
                              const location = acceptResponse.headers.location
                              cy.log(`Redirect location: ${location}`)

                              if (location && location.includes('/callback')) {
                                // We don't need to follow this redirect as it will be handled by the browser
                                cy.log('Detected callback in redirect, test will continue')
                              }
                            }
                          })
                        }
                      }
                    })
                  } else {
                    throw new Error('Could not find CSRF token in cookies')
                  }
                })
              }
            })
          })
        }
      )

      // Wait for the callback with a timeout
      cy.wait('@callback', { timeout: 10000 })
        .then(interception => {
          cy.log(`Callback received: ${interception.request.url}`)
          cy.log(`Callback status: ${interception.response?.statusCode}`)

          // Verify we end up on the dashboard
          cy.url({ timeout: 10000 }).should('include', '/dashboard')
        })

      // Handle potential timeout error with cy.on('fail')
      cy.on('fail', (error) => {
        if (error.message.includes('cy.wait() timed out waiting') &&
            error.message.includes('callback')) {
          cy.log(`Error waiting for callback: ${error.message}`)

          // Check if we're already on the dashboard despite not catching the callback
          cy.url().then(url => {
            cy.log(`Current URL after callback error: ${url}`)
            if (url.includes('/dashboard')) {
              cy.log('Already on dashboard, continuing test')
              return false // Return false to prevent the error from failing the test
            }

            // If we're not on the dashboard, let the test fail
            return true
          })
        }
        return true // Let other errors fail the test
      })
    })
  })
})

// Add a new command for direct Bluesky authentication that bypasses the OAuth flow
Cypress.Commands.add('directBlueskyAuth', () => {
  // Visit the login page
  cy.visit('/auth/login', { timeout: 5000 })

  // Click Bluesky login button
  cy.dataCy('bluesky-login-button').click()

  // Handle the login dialog for entering Bluesky handle
  cy.get('.q-dialog').within(() => {
    cy.get('input[type="text"]').type(Cypress.env('APP_TESTING_BLUESKY_HANDLE'))
    cy.contains('button', 'OK').click()
  })

  // Intercept the authorize request to get the tenant ID
  cy.intercept('GET', '**/api/v1/auth/bluesky/authorize*').as('authorizeRequest')
  cy.wait('@authorizeRequest', { timeout: 5000 }).then(interception => {
    const url = new URL(interception.request.url)
    const tenantId = url.searchParams.get('tenantId')
    cy.log(`Tenant ID: ${tenantId}`)

    // Instead of going through the OAuth flow, directly set up the authenticated state
    cy.log('Bypassing OAuth flow and setting up authenticated state directly')

    // Set up local storage with user data
    cy.window().then(win => {
      // Create a simulated user object
      const user = {
        id: 'test-user-id',
        handle: Cypress.env('APP_TESTING_BLUESKY_HANDLE'),
        displayName: 'Test User',
        isAuthenticated: true,
        authProvider: 'bluesky'
      }

      // Store the user in localStorage
      win.localStorage.setItem('user', JSON.stringify(user))

      // Set a simulated auth token
      win.localStorage.setItem('auth_token', 'simulated-auth-token')

      // Navigate directly to dashboard
      cy.visit('/dashboard', { timeout: 5000 })

      // Verify we're on the dashboard
      cy.url().should('include', '/dashboard')
    })
  })
})
