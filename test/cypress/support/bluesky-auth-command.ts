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

        // The cookie name is based on the request_uri parameter
        const cookieStr = allCookies
        cy.log('Cookie string:', cookieStr)

        // Extract device-id and session-id cookies
        const deviceIdMatch = cookieStr.match(/device-id=([^;]+)/)
        if (deviceIdMatch) {
          deviceIdCookie = deviceIdMatch[1]
          cy.log(`Device ID cookie: ${deviceIdCookie}`)
        }

        const sessionIdMatch = cookieStr.match(/session-id=([^;]+)/)
        if (sessionIdMatch) {
          sessionIdCookie = sessionIdMatch[1]
          cy.log(`Session ID cookie: ${sessionIdCookie}`)
        }

        // Look for a cookie that starts with 'csrf-' followed by the request_uri value
        if (requestUri) {
          const csrfCookieRegex = new RegExp(`csrf-${requestUri.replace(/:/g, '\\:').replace(/\./g, '\\.').replace(/\//g, '\\/')}=([^;]+)`)
          const csrfCookieMatch = cookieStr.match(csrfCookieRegex)

          if (csrfCookieMatch) {
            storedCsrfToken = csrfCookieMatch[1]
            cy.log('*************************************')
            cy.log(`***** CSRF TOKEN FOUND (EXACT MATCH): ${storedCsrfToken} *****`)
            cy.log('*************************************')
          } else {
            // Try a more generic pattern if exact match fails
            const genericCsrfMatch = cookieStr.match(/csrf-([^=]+)=([^;]+)/)
            if (genericCsrfMatch) {
              storedCsrfToken = genericCsrfMatch[2]
              cy.log('*************************************')
              cy.log(`***** CSRF TOKEN FOUND (GENERIC MATCH): ${storedCsrfToken} *****`)
              cy.log('*************************************')
            } else {
              cy.log('No CSRF cookie found in Set-Cookie header')
            }
          }
        }
      } else {
        cy.log('No Set-Cookie header found in response')
      }
    })

    cy.log('Modified headers for GET /oauth/authorize request')
    cy.log(`Headers: ${JSON.stringify(req.headers)}`)
  }).as('initialOAuth')

  cy.intercept('GET', '**/oauth/authorize**').as('oauthAuthorizeRequest')

  // Add intercept for the sign-in request to set cookies and headers
  cy.intercept('POST', '**/bsky.social/oauth/authorize/sign-in', (req) => {
    cy.log('DEBUG: Sign-in request intercepted')

    // Use the stored CSRF token if available
    if (storedCsrfToken) {
      cy.log(`Using stored CSRF token: ${storedCsrfToken}`)

      // Add more prominent logging
      cy.log('*************************************')
      cy.log(`***** USING CSRF TOKEN FOR SIGN-IN: ${storedCsrfToken} *****`)
      cy.log('*************************************')
    } else {
      cy.log('WARNING: No CSRF token found for sign-in request, this will likely fail')
      return
    }

    // Ensure requestUri and clientId are defined
    if (!requestUri || !clientId) {
      cy.log('WARNING: requestUri or clientId is undefined')
      return
    }

    // Build the cookie header using the captured cookies
    let cookieHeader = ''
    if (deviceIdCookie) {
      cookieHeader += `device-id=${deviceIdCookie}; `
    }
    if (sessionIdCookie) {
      cookieHeader += `session-id=${sessionIdCookie}; `
    }
    cookieHeader += `csrf-${requestUri}=${storedCsrfToken}`

    cy.log('Using cookie header:', cookieHeader)

    // Ensure the CSRF token is set in both headers and body
    req.headers = {
      ...req.headers,
      cookie: cookieHeader,
      'x-csrf-token': storedCsrfToken,
      'sec-fetch-mode': 'same-origin',
      'sec-fetch-site': 'same-origin',
      'sec-fetch-dest': 'empty',
      'content-type': 'application/json',
      accept: '*/*',
      'accept-language': 'en-US,en;q=0.5',
      'accept-encoding': 'gzip, deflate, br, zstd',
      origin: 'https://bsky.social',
      referer: `https://bsky.social/oauth/authorize?client_id=${encodeURIComponent(clientId)}&request_uri=${encodeURIComponent(requestUri)}`,
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0'
    }

    // The request body must include both csrf_token and request_uri
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

    cy.log('Sign-in request headers:', JSON.stringify(req.headers))
    cy.log('Sign-in request body:', JSON.stringify(req.body))

    // Log the actual request that will be sent
    cy.log('*************************************')
    cy.log(`***** SIGN-IN REQUEST CSRF TOKEN: ${req.body.csrf_token} *****`)
    cy.log(`***** SIGN-IN REQUEST URI: ${req.body.request_uri} *****`)
    cy.log('*************************************')
  }).as('oauthSignInRequest')

  // Add intercept for the accept request to set cookies and CSRF token
  cy.intercept('GET', '**/oauth/authorize/accept**', (req) => {
    // Set required security headers
    req.headers['sec-fetch-mode'] = 'navigate'
    req.headers['sec-fetch-dest'] = 'document'
    req.headers['sec-fetch-site'] = 'same-origin'
    req.headers['user-agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0'

    // Set cookies if available
    if (deviceIdCookie) {
      req.headers.cookie = `device-id=${deviceIdCookie}`
      if (sessionIdCookie) {
        req.headers.cookie += `; session-id=${sessionIdCookie}`
      }
      if (storedCsrfToken && requestUri) {
        req.headers.cookie += `; csrf-${requestUri}=${storedCsrfToken}`
      }
      cy.log(`Setting cookies for accept request: ${req.headers.cookie}`)
    }

    // Add CSRF token to URL if available
    if (storedCsrfToken) {
      const url = new URL(req.url)
      url.searchParams.set('csrf_token', storedCsrfToken)
      req.url = url.toString()
      cy.log(`Modified URL to include CSRF token: ${req.url}`)
    }

    cy.log('Modified headers for GET /oauth/authorize/accept request')
    cy.log(`Headers: ${JSON.stringify(req.headers)}`)
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

        // Check if window.open was called and get the URL
        cy.get('@windowOpen').then(windowOpen => {
          // Cast to unknown first to avoid type errors
          const stub = windowOpen as unknown as { called: boolean; args: Array<Array<string>> }

          // If window.open was called, we need to handle it
          if (stub.called) {
            cy.log('window.open was called, handling it directly')
            // Get the URL that window.open was called with
            const popupUrl = stub.args[0][0]
            cy.log(`Popup URL: ${popupUrl}`)

            // Instead of opening in a popup, we'll visit it directly
            const authOrigin = new URL(authUrl).origin

            // Set up all intercepts before cy.origin
            cy.intercept('POST', '**/oauth/authorize/sign-in', (req) => {
              // Set required security headers
              req.headers['sec-fetch-mode'] = 'same-origin'
              req.headers['sec-fetch-site'] = 'same-origin'
              req.headers['sec-fetch-dest'] = 'empty'

              // Set the CSRF token in the header
              if (storedCsrfToken) {
                req.headers['x-csrf-token'] = storedCsrfToken
              }

              // Set cookies
              if (deviceIdCookie && sessionIdCookie && storedCsrfToken && requestUri) {
                const cookieHeader = `device-id=${deviceIdCookie}; session-id=${sessionIdCookie}; csrf-${requestUri}=${storedCsrfToken}`
                req.headers.cookie = cookieHeader
              }

              cy.log('Modified headers for POST /oauth/authorize/sign-in request')
              cy.log(`Headers: ${JSON.stringify(req.headers)}`)
            }).as('signIn')

            cy.intercept('GET', '**/oauth/authorize/decide', (req) => {
              // Set required security headers
              req.headers['sec-fetch-mode'] = 'navigate'
              req.headers['sec-fetch-site'] = 'same-origin'
              req.headers['sec-fetch-dest'] = 'document'

              // Set cookies
              if (deviceIdCookie && sessionIdCookie && storedCsrfToken && requestUri) {
                const cookieHeader = `device-id=${deviceIdCookie}; session-id=${sessionIdCookie}; csrf-${requestUri}=${storedCsrfToken}`
                req.headers.cookie = cookieHeader
              }

              cy.log('Modified headers for GET /oauth/authorize/decide request')
              cy.log(`Headers: ${JSON.stringify(req.headers)}`)
            }).as('decide')

            cy.intercept('POST', '**/oauth/authorize/accept', (req) => {
              // Set required security headers
              req.headers['sec-fetch-mode'] = 'same-origin'
              req.headers['sec-fetch-site'] = 'same-origin'
              req.headers['sec-fetch-dest'] = 'empty'

              // Set the CSRF token in the header
              if (storedCsrfToken) {
                req.headers['x-csrf-token'] = storedCsrfToken
              }

              // Set cookies
              if (deviceIdCookie && sessionIdCookie && storedCsrfToken && requestUri) {
                const cookieHeader = `device-id=${deviceIdCookie}; session-id=${sessionIdCookie}; csrf-${requestUri}=${storedCsrfToken}`
                req.headers.cookie = cookieHeader
              }

              cy.log('Modified headers for POST /oauth/authorize/accept request')
              cy.log(`Headers: ${JSON.stringify(req.headers)}`)
            }).as('accept')

            cy.intercept('GET', '**/api/v1/auth/bluesky/callback**').as('callback')

            // Add an intercept for the GET request to /oauth/authorize/accept
            cy.intercept('GET', '**/oauth/authorize/accept**', (req) => {
              // Modify the headers to set sec-fetch-dest to "document"
              req.headers['sec-fetch-dest'] = 'document'
              req.headers['sec-fetch-mode'] = 'navigate'
              req.headers['sec-fetch-site'] = 'same-origin'

              // Build the cookie header using the captured cookies
              if (deviceIdCookie && sessionIdCookie && storedCsrfToken && requestUri) {
                const cookieHeader = `device-id=${deviceIdCookie}; session-id=${sessionIdCookie}; csrf-${requestUri}=${storedCsrfToken}`
                req.headers.cookie = cookieHeader
                cy.log(`Setting cookie header for GET request: ${cookieHeader}`)
              }

              // Set additional headers that might be needed
              req.headers.accept = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
              req.headers['accept-language'] = 'en-US,en;q=0.9'
              req.headers['upgrade-insecure-requests'] = '1'
              req.headers['user-agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

              // Fix the URL to include the CSRF token properly
              const url = new URL(req.url)
              if (storedCsrfToken) {
                url.searchParams.set('csrf_token', storedCsrfToken)
                req.url = url.toString()
                cy.log(`Modified URL to include CSRF token: ${req.url}`)
              }

              cy.log('Modified headers for GET /oauth/authorize/accept request')
              cy.log(`sec-fetch-dest: ${req.headers['sec-fetch-dest']}`)
              cy.log(`Headers: ${JSON.stringify(req.headers)}`)
            }).as('acceptGet')

            // Define the type for the origin arguments
            interface OriginArgs {
              authUrl: string;
              password: string;
              requestUri: string | undefined;
              clientId: string | undefined;
              storedCsrfToken: string | undefined;
              deviceIdCookie: string | undefined;
              sessionIdCookie: string | undefined;
            }

            const originArgs: OriginArgs = {
              authUrl,
              password: Cypress.env('APP_TESTING_BLUESKY_PASSWORD'),
              requestUri,
              clientId,
              storedCsrfToken,
              deviceIdCookie,
              sessionIdCookie
            }

            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const originCallback = (args: OriginArgs) => {
              const { authUrl, password, requestUri, storedCsrfToken, deviceIdCookie, sessionIdCookie } = args
              // We don't need clientId in this function anymore

              // Set up a beforeEach hook to ensure headers are set for all requests
              Cypress.on('window:before:load', (win) => {
                // Override fetch to add headers
                const originalFetch = win.fetch
                win.fetch = function (input, init) {
                  init = init || {}
                  init.headers = init.headers || {}

                  // Add sec-fetch headers - use type assertion to avoid TypeScript errors
                  const headers = init.headers as Record<string, string>

                  // Check if this is a POST request to the sign-in endpoint
                  const url = typeof input === 'string' ? input : input instanceof Request ? input.url : ''
                  if (url.includes('/oauth/authorize/sign-in')) {
                    headers['sec-fetch-mode'] = 'same-origin'
                    headers['sec-fetch-dest'] = 'empty'
                    headers['sec-fetch-site'] = 'same-origin'
                  } else {
                    // For other requests, use navigate
                    headers['sec-fetch-mode'] = 'navigate'
                    headers['sec-fetch-dest'] = 'document'
                    headers['sec-fetch-site'] = 'same-origin'
                  }

                  // Add cookies if available
                  if (deviceIdCookie || sessionIdCookie) {
                    let cookieStr = ''
                    if (deviceIdCookie) {
                      cookieStr += `device-id=${deviceIdCookie};`
                    }
                    if (sessionIdCookie) {
                      cookieStr += ` session-id=${sessionIdCookie};`
                    }
                    if (storedCsrfToken && requestUri) {
                      cookieStr += ` csrf-${requestUri}=${storedCsrfToken};`
                    }
                    headers.cookie = cookieStr
                  }

                  return originalFetch.call(this, input, init)
                }

                // Set cookies directly on the document
                if (deviceIdCookie) {
                  win.document.cookie = `device-id=${deviceIdCookie}; path=/; domain=.bsky.social`
                }
                if (sessionIdCookie) {
                  win.document.cookie = `session-id=${sessionIdCookie}; path=/; domain=.bsky.social`
                }
                if (storedCsrfToken && requestUri) {
                  win.document.cookie = `csrf-${requestUri}=${storedCsrfToken}; path=/; domain=.bsky.social`
                }
              })

              // Visit the auth URL directly in the main window
              cy.visit(authUrl, {
                headers: {
                  'sec-fetch-mode': 'navigate',
                  'sec-fetch-dest': 'document',
                  'sec-fetch-site': 'none',
                  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0'
                },
                onBeforeLoad: (win) => {
                  // Override XMLHttpRequest to add headers
                  const originalOpen = win.XMLHttpRequest.prototype.open

                  // Use a type-safe approach for the open method
                  win.XMLHttpRequest.prototype.open = function (method: string, url: string, async: boolean = true, username?: string | null, password?: string | null) {
                    const result = originalOpen.call(this, method, url, async, username || null, password || null)

                    // Set appropriate headers based on the request URL
                    if (url.includes('/oauth/authorize/sign-in')) {
                      this.setRequestHeader('sec-fetch-mode', 'same-origin')
                      this.setRequestHeader('sec-fetch-dest', 'empty')
                      this.setRequestHeader('sec-fetch-site', 'same-origin')
                    } else {
                      this.setRequestHeader('sec-fetch-mode', 'navigate')
                      this.setRequestHeader('sec-fetch-dest', 'document')
                      this.setRequestHeader('sec-fetch-site', 'same-origin')
                    }

                    return result
                  }

                  // Set cookies directly on the document
                  if (deviceIdCookie) {
                    win.document.cookie = `device-id=${deviceIdCookie}; path=/; domain=.bsky.social`
                  }
                  if (sessionIdCookie) {
                    win.document.cookie = `session-id=${sessionIdCookie}; path=/; domain=.bsky.social`
                  }
                  if (storedCsrfToken && requestUri) {
                    win.document.cookie = `csrf-${requestUri}=${storedCsrfToken}; path=/; domain=.bsky.social`
                  }
                }
              })

              // Wait for the page to load and check what elements are available
              cy.document().then(doc => {
                // Log all input elements to debug
                const inputs = doc.querySelectorAll('input')
                cy.log(`Found ${inputs.length} input elements on the page`)
                inputs.forEach((input, index) => {
                  cy.log(`Input ${index}: type=${input.type}, name=${input.name}, id=${input.id}`)
                })

                // Log all form elements
                const forms = doc.querySelectorAll('form')
                cy.log(`Found ${forms.length} form elements on the page`)
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

                  // Also set cookies directly on the document again
                  if (deviceIdCookie) {
                    doc.cookie = `device-id=${deviceIdCookie}; path=/; domain=.bsky.social`
                  }
                  if (sessionIdCookie) {
                    doc.cookie = `session-id=${sessionIdCookie}; path=/; domain=.bsky.social`
                  }
                  if (requestUri) {
                    doc.cookie = `csrf-${requestUri}=${storedCsrfToken}; path=/; domain=.bsky.social`
                  }
                }
              })

              // Submit the form by clicking the submit button
              cy.get('form button[type="submit"]').click()

              // Log the current URL to see if we're redirected
              cy.url().then(url => {
                cy.log(`URL after form submission: ${url}`)
              })

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

                // Log the current URL to see if we're redirected
                cy.url().then(url => {
                  cy.log(`URL after authorization: ${url}`)
                })
              })
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

            // Verify user data is loaded correctly
            cy.window().then(win => {
              // Check for user data in localStorage
              const userDataRaw = win.localStorage.getItem('user')
              cy.wrap(userDataRaw).should('not.be.null')

              // Check for auth token
              const authTokenRaw = win.localStorage.getItem('token')
              cy.wrap(authTokenRaw).should('not.be.null')

              // Handle Quasar's special string format if present
              if (userDataRaw && userDataRaw.startsWith('__q_strn|')) {
                // Extract the JSON part after the prefix
                const userData = JSON.parse(userDataRaw.substring(9))
                cy.log('Parsed Quasar-formatted user data')
                cy.log(`User data: ${JSON.stringify(userData)}`)
              }
            })
          }
        })
      })
    })
  })
})
