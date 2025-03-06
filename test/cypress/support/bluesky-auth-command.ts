// Bluesky authentication command
// This file contains the implementation of the authenticateWithBluesky command
// based on the working implementation from bluesky-auth-fixed.cy.ts

// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace Cypress {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
  interface Chainable<Subject = any> {
    authenticateWithBluesky(): Chainable<void>
  }
}

// Command to authenticate with Bluesky using the fixed implementation
Cypress.Commands.add('authenticateWithBluesky', () => {
  // Create variables to store tokens and cookies that will be accessible throughout the test
  let storedCsrfToken: string | undefined
  let requestUri: string | undefined
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let clientId: string | undefined
  let deviceIdCookie: string | undefined
  let sessionIdCookie: string | undefined
  let allCookies: string | undefined

  // Stub window.open before any interactions to prevent popup
  cy.window().then((win) => {
    cy.stub(win, 'open').as('windowOpen')
  })

  // Set up intercepts for monitoring the OAuth flow
  cy.intercept('GET', '**/api/v1/auth/bluesky/authorize*').as('authorizeRequest')

  // Add intercept for the OAuth authorize request to ensure headers are set correctly
  cy.intercept('GET', '**/bsky.social/oauth/authorize*', (req) => {
    // Set required security headers
    req.headers['sec-fetch-mode'] = 'navigate'
    req.headers['sec-fetch-dest'] = 'document'
    req.headers['sec-fetch-site'] = 'none'
    req.headers['user-agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0'

    // Capture the CSRF token from the response
    req.on('response', (res) => {
      cy.log('OAuth page response headers:', JSON.stringify(res.headers))

      // Extract request_uri from the URL
      const urlObj = new URL(req.url)
      const reqUri = urlObj.searchParams.get('request_uri')
      const clId = urlObj.searchParams.get('client_id')

      // Safely assign values, handling null
      requestUri = reqUri || undefined
      clientId = clId || undefined

      cy.log(`Request URI from URL: ${requestUri || 'Not found'}`)
      cy.log(`Client ID from URL: ${clientId || 'Not found'}`)

      // Look for the CSRF token and other cookies in the Set-Cookie header
      const setCookieHeader = res.headers['set-cookie']
      if (setCookieHeader) {
        cy.log('Set-Cookie header found:', setCookieHeader)

        // Store all cookies for future requests
        allCookies = Array.isArray(setCookieHeader) ? setCookieHeader.join('; ') : setCookieHeader.toString()
        cy.log('All cookies:', allCookies)

        // Extract device-id and session-id cookies
        const deviceIdMatch = allCookies.match(/device-id=([^;]+)/)
        if (deviceIdMatch) {
          deviceIdCookie = deviceIdMatch[1]
          cy.log(`Device ID cookie: ${deviceIdCookie}`)
        }

        const sessionIdMatch = allCookies.match(/session-id=([^;]+)/)
        if (sessionIdMatch) {
          sessionIdCookie = sessionIdMatch[1]
          cy.log(`Session ID cookie: ${sessionIdCookie}`)
        }

        // Look for a cookie that starts with 'csrf-' followed by the request_uri value
        if (requestUri) {
          const csrfCookieRegex = new RegExp(`csrf-${requestUri.replace(/:/g, '\\:').replace(/\./g, '\\.').replace(/\//g, '\\/')}=([^;]+)`)
          const csrfCookieMatch = allCookies.match(csrfCookieRegex)

          if (csrfCookieMatch) {
            storedCsrfToken = csrfCookieMatch[1]
            cy.log('*************************************')
            cy.log(`***** CSRF TOKEN FOUND (EXACT MATCH): ${storedCsrfToken} *****`)
            cy.log('*************************************')
          } else {
            // Try a more generic pattern if exact match fails
            const genericCsrfMatch = allCookies.match(/csrf-([^=]+)=([^;]+)/)
            if (genericCsrfMatch) {
              storedCsrfToken = genericCsrfMatch[2]
              cy.log('*************************************')
              cy.log(`***** CSRF TOKEN FOUND (GENERIC MATCH): ${storedCsrfToken} *****`)
              cy.log('*************************************')
            }
          }
        }
      }
    })
  }).as('initialOAuth')

  cy.intercept('GET', '**/oauth/authorize**').as('oauthAuthorizeRequest')

  // Add intercept for the sign-in request to set cookies and headers
  cy.intercept('POST', '**/bsky.social/oauth/authorize/sign-in', (req) => {
    cy.log('DEBUG: Sign-in request intercepted')

    // Ensure the CSRF token is set in both headers and body
    if (storedCsrfToken && requestUri && clientId) {
      // Build the cookie header
      const cookieHeader = `device-id=${deviceIdCookie || ''}; session-id=${sessionIdCookie || ''}; csrf-${requestUri}=${storedCsrfToken}`

      // Set headers
      req.headers = {
        ...req.headers,
        cookie: cookieHeader,
        'x-csrf-token': storedCsrfToken,
        'sec-fetch-mode': 'same-origin',
        'sec-fetch-site': 'same-origin',
        'sec-fetch-dest': 'empty',
        'content-type': 'application/json',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0',
        referer: `https://bsky.social/oauth/authorize?client_id=${encodeURIComponent(clientId)}&request_uri=${encodeURIComponent(requestUri)}`
      }

      // Set body
      req.body = {
        csrf_token: storedCsrfToken,
        request_uri: requestUri,
        client_id: clientId,
        credentials: {
          username: Cypress.env('APP_TESTING_BLUESKY_HANDLE'),
          password: Cypress.env('APP_TESTING_BLUESKY_PASSWORD'),
          remember: false
        }
      }

      cy.log(`***** SIGN-IN REQUEST CSRF TOKEN: ${req.body.csrf_token} *****`)
    }
  }).as('oauthSignInRequest')

  // Add intercept for the accept request to set cookies and CSRF token
  cy.intercept('GET', '**/oauth/authorize/accept**', (req) => {
    // Set cookies if available
    if (storedCsrfToken && requestUri) {
      // Build cookie header
      const cookieHeader = `device-id=${deviceIdCookie || ''}; session-id=${sessionIdCookie || ''}; csrf-${requestUri}=${storedCsrfToken}`

      // Set headers
      req.headers = {
        ...req.headers,
        cookie: cookieHeader,
        'sec-fetch-mode': 'navigate',
        'sec-fetch-dest': 'document',
        'sec-fetch-site': 'same-origin',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0'
      }

      // Add CSRF token to URL
      const url = new URL(req.url)
      url.searchParams.set('csrf_token', storedCsrfToken)
      req.url = url.toString()

      cy.log(`Setting cookie header for GET request: ${cookieHeader}`)
      cy.log(`Modified URL to include CSRF token: ${req.url}`)
    }
  }).as('acceptGet')

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
      headers: {
        Accept: 'text/plain'
      }
    }).then((response) => {
      const authUrl = response.body as string
      cy.log(`Auth URL: ${authUrl}`)

      // Extract the request_uri and client_id from the auth URL
      const authUrlObj = new URL(authUrl)
      const reqUri = authUrlObj.searchParams.get('request_uri')
      const clId = authUrlObj.searchParams.get('client_id')

      // Safely assign values, handling null
      requestUri = reqUri || undefined
      clientId = clId || undefined

      cy.log(`Request URI from auth URL: ${requestUri || 'Not found'}`)
      cy.log(`Client ID from auth URL: ${clientId || 'Not found'}`)

      if (!requestUri) {
        throw new Error('request_uri not found in auth URL')
      }

      // Make a direct request to the OAuth authorize URL to get the CSRF token
      cy.request({
        url: authUrl,
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'sec-fetch-mode': 'navigate',
          'sec-fetch-dest': 'document',
          'sec-fetch-site': 'none',
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0'
        }
      }).then(oauthResponse => {
        cy.log('Direct OAuth response status:', oauthResponse.status)

        // Extract the CSRF token and cookies from the Set-Cookie header
        const setCookieHeader = oauthResponse.headers['set-cookie']
        if (setCookieHeader) {
          cy.log('Direct OAuth Set-Cookie header:', setCookieHeader)

          // Store all cookies for future requests
          allCookies = Array.isArray(setCookieHeader) ? setCookieHeader.join('; ') : setCookieHeader.toString()
          cy.log('All cookies:', allCookies)

          // Extract device-id and session-id cookies if not already set
          if (!deviceIdCookie) {
            const deviceIdMatch = allCookies.match(/device-id=([^;]+)/)
            if (deviceIdMatch) {
              deviceIdCookie = deviceIdMatch[1]
              cy.log(`Device ID cookie: ${deviceIdCookie}`)
            }
          }

          if (!sessionIdCookie) {
            const sessionIdMatch = allCookies.match(/session-id=([^;]+)/)
            if (sessionIdMatch) {
              sessionIdCookie = sessionIdMatch[1]
              cy.log(`Session ID cookie: ${sessionIdCookie}`)
            }
          }

          // Look for a cookie that starts with 'csrf-' followed by the request_uri
          if (requestUri) {
            const csrfCookieRegex = new RegExp(`csrf-${requestUri.replace(/:/g, '\\:').replace(/\./g, '\\.').replace(/\//g, '\\/')}=([^;]+)`)
            const csrfCookieMatch = allCookies.match(csrfCookieRegex)

            if (csrfCookieMatch) {
              storedCsrfToken = csrfCookieMatch[1]
              cy.log('*************************************')
              cy.log(`***** DIRECT CSRF TOKEN FOUND: ${storedCsrfToken} *****`)
              cy.log('*************************************')
            } else {
              // Try a more generic pattern
              const genericMatch = allCookies.match(/csrf-([^=]+)=([^;]+)/)
              if (genericMatch) {
                storedCsrfToken = genericMatch[2]
                cy.log('*************************************')
                cy.log(`***** GENERIC CSRF TOKEN FOUND: ${storedCsrfToken} *****`)
                cy.log('*************************************')
              } else {
                cy.log('No CSRF token found in direct OAuth response')
              }
            }
          }
        }

        // Get the window.open stub to check if it was called
        cy.get('@windowOpen').then(windowOpen => {
          // Check if window.open was called
          if ((windowOpen as unknown as { called: boolean }).called) {
            cy.log('window.open was called, handling it directly')

            // Get the URL that was passed to window.open
            const popupUrl = (windowOpen as unknown as { args: Array<Array<string>> }).args[0][0]
            cy.log(`Popup URL: ${popupUrl}`)

            // Extract the origin from the popup URL
            const popupUrlObj = new URL(popupUrl)
            const authOrigin = popupUrlObj.origin

            // Define the OriginArgs interface
            interface OriginArgs {
              authUrl: string;
              password: string;
              requestUri: string | undefined;
              clientId: string | undefined;
              storedCsrfToken: string | undefined;
              deviceIdCookie: string | undefined;
              sessionIdCookie: string | undefined;
            }

            // Define the origin callback function
            const originCallback = (args: OriginArgs) => {
              const { authUrl, password, storedCsrfToken } = args
              // We don't need clientId, requestUri, deviceIdCookie, or sessionIdCookie in this function

              // Visit the auth URL directly in the main window
              cy.visit(authUrl, {
                headers: {
                  'sec-fetch-mode': 'navigate',
                  'sec-fetch-dest': 'document',
                  'sec-fetch-site': 'none',
                  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0'
                }
              })

              // Try different selectors for the password input
              cy.get('input[type="password"], input[name="password"], .password-input', { timeout: 10000 })
                .should('exist')
                .then($input => {
                  cy.log(`Found password input: ${$input.attr('type')}, ${$input.attr('name')}, ${$input.attr('class')}`)
                  cy.wrap($input).type(password, { force: true })
                })

              // Log the CSRF token we're using
              cy.log('*************************************')
              cy.log(`***** USING CSRF TOKEN IN ORIGIN: ${storedCsrfToken} *****`)
              cy.log('*************************************')

              // Set the CSRF token in the form before submission
              cy.document().then(doc => {
                const form = doc.querySelector('form')
                if (form && storedCsrfToken) {
                  // Look for the csrf_token input field
                  const csrfInput = form.querySelector('input[name="csrf_token"]') as HTMLInputElement
                  if (csrfInput) {
                    csrfInput.value = storedCsrfToken
                    cy.log(`CSRF token set in form: ${storedCsrfToken}`)
                  } else {
                    // Create a new input if it doesn't exist
                    const input = doc.createElement('input')
                    input.type = 'hidden'
                    input.name = 'csrf_token'
                    input.value = storedCsrfToken
                    form.appendChild(input)
                    cy.log(`Created and added CSRF token input to form: ${storedCsrfToken}`)
                  }
                }
              })

              // Submit the form by clicking the submit button
              cy.get('form button[type="submit"]').click()

              // After successful sign-in, we should be redirected to the authorization page
              // Look for the "Accept" button and click it
              cy.contains('button', 'Accept', { timeout: 10000 }).should('be.visible').then(() => {
                // Ensure the CSRF token is set just before clicking the allow button
                cy.log(`Setting CSRF token in accept form: ${storedCsrfToken}`)

                // Set the CSRF token in the form before clicking Accept
                cy.document().then(doc => {
                  const form = doc.querySelector('form')
                  if (form && storedCsrfToken) {
                    // Look for the csrf_token input field
                    const csrfInput = form.querySelector('input[name="csrf_token"]') as HTMLInputElement
                    if (csrfInput) {
                      csrfInput.value = storedCsrfToken
                      cy.log(`CSRF token set in accept form: ${storedCsrfToken}`)
                    } else {
                      // Create a new input if it doesn't exist
                      const input = doc.createElement('input')
                      input.type = 'hidden'
                      input.name = 'csrf_token'
                      input.value = storedCsrfToken
                      form.appendChild(input)
                      cy.log(`Created and added CSRF token input to accept form: ${storedCsrfToken}`)
                    }
                  }
                })

                // Click the Accept button
                cy.contains('button', 'Accept').click()
              })
            }

            // Call the origin function with the necessary arguments
            const originArgs: OriginArgs = {
              authUrl,
              password: Cypress.env('APP_TESTING_BLUESKY_PASSWORD'),
              requestUri,
              clientId,
              storedCsrfToken,
              deviceIdCookie,
              sessionIdCookie
            }

            cy.origin(authOrigin, { args: originArgs }, originCallback)
          } else {
            cy.log('window.open was not called, using alternative approach')

            // Wait for the callback to be processed
            cy.wait('@callback', { timeout: 30000 })
              .then(callbackInterception => {
                cy.log(`Callback received: ${callbackInterception.request.url}`)
                cy.log(`Callback status: ${callbackInterception.response?.statusCode}`)
              })

            // Verify we're redirected to / (root path of any domain)
            cy.url({ timeout: 10000 }).should('match', /^https?:\/\/[^/]+\/?$/).then((url) => {
              cy.log(`Successfully redirected to: ${url}`)
            })
          }
        })
      })
    })
  })
})
