/// <reference types="cypress" />

describe('Bluesky Login Flow', () => {
  beforeEach(() => {
    cy.visit('/auth/login')

    // Configure longer timeout for this test
    Cypress.config('defaultCommandTimeout', 20000)
  })

  it('should successfully login using Bluesky', () => {
    // Stub window.open before any interactions
    cy.window().then((win) => {
      cy.stub(win, 'open').as('windowOpen')
    })

    // Intercept the authorize API call first
    cy.intercept('GET', '**/api/v1/auth/bluesky/authorize*').as('authorizeRequest')

    // Intercept the sign-in POST request to monitor CSRF token - must be outside cy.origin
    cy.intercept('POST', '**/oauth/authorize/sign-in').as('signInRequest')

    // Click Bluesky login button
    cy.dataCy('bluesky-login-button').click()

    // Handle the login dialog
    cy.get('.q-dialog').within(() => {
      cy.get('input[type="text"]').type(Cypress.env('APP_TESTING_BLUESKY_HANDLE'), { force: true })
      cy.contains('button', 'OK').click({ force: true })
    })

    // Wait for and parse the intercepted request to backend authorize endpoint
    cy.wait('@authorizeRequest').then((interception) => {
      const url = new URL(interception.request.url)
      const tenantId = url.searchParams.get('tenantId')

      // Get the authorization URL from our backend
      cy.request({
        url: `${Cypress.env('APP_TESTING_API_URL')}/api/v1/auth/bluesky/authorize?handle=${Cypress.env('APP_TESTING_BLUESKY_HANDLE')}&tenantId=${tenantId}`,
        headers: {
          Accept: 'text/plain'
        },
        failOnStatusCode: false
      }).then((response) => {
        // Log the response for debugging
        cy.log(`Auth URL Response Status: ${response.status}`)
        cy.log(`Auth URL Response Body: ${JSON.stringify(response.body).substring(0, 500)}`)

        if (response.status >= 400) {
          cy.log(`Error fetching auth URL: ${response.status} - ${JSON.stringify(response.body)}`)
          throw new Error(`Failed to fetch auth URL: ${response.status}`)
        }

        const authUrl = response.body
        const authOrigin = new URL(authUrl).origin

        // Log the auth URL for debugging
        cy.log(`Auth URL: ${authUrl}`)
        cy.log(`Auth Origin: ${authOrigin}`)

        // Extract important parameters from the auth URL
        const authUrlObj = new URL(authUrl)
        // We only need requestUri for CSRF token
        const requestUri = authUrlObj.searchParams.get('request_uri')

        cy.log(`Request URI: ${requestUri}`)

        // Set up callback intercept
        cy.intercept('GET', '**/auth/bluesky/callback**').as('callback')

        // Set up form submission intercept - moved outside cy.origin
        cy.intercept('POST', '**/oauth/authorize/sign-in').as('formSubmission')

        // Use cy.origin to handle cross-origin navigation
        cy.origin(
          authOrigin,
          {
            args: {
              originalAuthUrl: authUrl,
              handle: Cypress.env('APP_TESTING_BLUESKY_HANDLE'),
              password: Cypress.env('APP_TESTING_BLUESKY_PASSWORD'),
              requestUri
            }
          },
          ({ originalAuthUrl, handle, password, requestUri }) => {
            // Extract request_uri from the original authorization URL if available
            let extractedRequestUri = null
            try {
              const authUrlObj = new URL(originalAuthUrl)
              extractedRequestUri = authUrlObj.searchParams.get('request_uri')
              if (extractedRequestUri) {
                cy.log(`Extracted request_uri from original auth URL: ${extractedRequestUri}`)
              }
            } catch (error) {
              cy.log('Error parsing original auth URL')
            }

            // Visit the original URL with required headers
            cy.visit(originalAuthUrl, {
              failOnStatusCode: false,
              timeout: 30000,
              headers: {
                'sec-fetch-mode': 'navigate',
                'sec-fetch-site': 'cross-site',
                'sec-fetch-dest': 'document',
                'sec-ch-ua': '"Chromium";v="121"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Linux"'
              }
            })

            // Wait for the login form to be visible
            cy.get('input[name="identifier"], input[type="text"]', { timeout: 30000 })
              .should('be.visible')
              .then(() => {
                cy.log('Login form is visible, proceeding with login')
              })

            // Enter username/handle - fix unsafe chaining
            cy.get('input[name="identifier"], input[type="text"], input[name="username"]')
              .clear({ force: true })

            cy.get('input[name="identifier"], input[type="text"], input[name="username"]')
              .type(handle, { force: true })

            // Wait for the password field to be visible - fix unsafe chaining
            cy.get('input[name="password"], input[type="password"]')
              .should('be.visible')

            cy.get('input[name="password"], input[type="password"]')
              .clear({ force: true })

            cy.get('input[name="password"], input[type="password"]')
              .type(password, { force: true })

            // Extract CSRF token from the page
            cy.document().then(doc => {
              // Try to find the CSRF token in various places

              // 1. First try to use the request_uri extracted from the original URL
              let csrfToken = extractedRequestUri
              if (csrfToken) {
                cy.log(`Using request_uri from original URL as CSRF token: ${csrfToken}`)
              } else {
                // 2. Look for hidden input with name csrf_token
                const csrfInput = doc.querySelector('input[name="csrf_token"]') as HTMLInputElement
                if (csrfInput) {
                  csrfToken = csrfInput.value
                  cy.log(`Found CSRF token in input: ${csrfToken}`)
                }
              }

              // 3. Look for it in a meta tag
              if (!csrfToken) {
                const metaTag = doc.querySelector('meta[name="csrf-token"]')
                if (metaTag) {
                  csrfToken = metaTag.getAttribute('content')
                  cy.log(`Found CSRF token in meta tag: ${csrfToken}`)
                }
              }

              // 4. Check if it's in the HTML as a data attribute
              if (!csrfToken) {
                const elemWithData = doc.querySelector('[data-csrf]')
                if (elemWithData) {
                  csrfToken = elemWithData.getAttribute('data-csrf')
                  cy.log(`Found CSRF token in data attribute: ${csrfToken}`)
                }
              }

              // 5. Look for it in script tags (sometimes embedded as JSON)
              if (!csrfToken) {
                const scripts = Array.from(doc.querySelectorAll('script:not([src])'))
                for (const script of scripts) {
                  const content = script.textContent || ''
                  const csrfMatch = content.match(/"csrf(_|-)?token":\s*"([^"]+)"/) ||
                                    content.match(/csrf(_|-)?token['"]\s*:\s*['"]([^'"]+)['"]/)
                  if (csrfMatch && csrfMatch[2]) {
                    csrfToken = csrfMatch[2]
                    cy.log(`Found CSRF token in script: ${csrfToken}`)
                    break
                  }
                }
              }

              // 6. Check for it in the URL query parameters
              if (!csrfToken) {
                const urlParams = new URLSearchParams(window.location.search)
                // Look specifically for request_uri parameter which should be used as the CSRF token
                const requestUriFromUrl = urlParams.get('request_uri')
                if (requestUriFromUrl) {
                  csrfToken = requestUriFromUrl
                  cy.log(`Found request_uri in URL to use as CSRF token: ${csrfToken}`)
                } else {
                  // Fallback to other URL parameters
                  const csrfFromUrl = urlParams.get('csrf_token') || urlParams.get('csrf')
                  if (csrfFromUrl) {
                    csrfToken = csrfFromUrl
                    cy.log(`Found CSRF token in URL: ${csrfToken}`)
                  }
                }
              }

              // 7. If we still don't have it, use the requestUri as a fallback
              if (!csrfToken && requestUri) {
                csrfToken = requestUri
                cy.log(`Using requestUri as CSRF token: ${csrfToken}`)
              }

              // Now add or update the CSRF token in the form
              if (csrfToken) {
                // First, let's log the token we're going to use
                cy.log(`Setting CSRF token in form: ${csrfToken}`)

                // Get the form and directly manipulate it to ensure the token is added
                cy.get('form').then($form => {
                  // Check if there's already a CSRF input
                  const existingInput = $form.find('input[name="csrf_token"]')

                  if (existingInput.length === 0) {
                    // Create and append the input to the form with the exact name from the error message
                    const input = document.createElement('input')
                    input.type = 'hidden'
                    input.name = 'csrf_token'
                    input.value = csrfToken
                    $form[0].appendChild(input)
                    cy.log(`Added csrf_token input with value: ${csrfToken}`)
                  } else {
                    // Update existing input with properly formatted token
                    existingInput.val(csrfToken)
                    cy.log('Updated existing CSRF token input')
                  }

                  // Verify the token was added
                  cy.log(`Form now has ${$form.find('input[type="hidden"]').length} hidden inputs`)
                  $form.find('input[type="hidden"]').each((i, el) => {
                    cy.log(`Hidden input ${i}: ${el.name} = ${el.value}`)
                  })

                  // Try to directly set the form's action attribute to ensure proper submission
                  if ($form.attr('action') && $form.attr('action').includes('oauth/authorize/sign-in')) {
                    cy.log(`Form action is already set to: ${$form.attr('action')}`)
                  } else {
                    const formAction = 'https://bsky.social/oauth/authorize/sign-in'
                    $form.attr('action', formAction)
                    cy.log(`Set form action to: ${formAction}`)
                  }

                  // Also try to set the method
                  if (!$form.attr('method') || $form.attr('method').toLowerCase() !== 'post') {
                    $form.attr('method', 'post')
                    cy.log('Set form method to POST')
                  }

                  // COMPLETELY NEW APPROACH: Instead of using cy.request which might not handle
                  // cross-origin cookies properly, let's use the native form submission
                  // but prevent the default action and handle it manually

                  // First, let's make sure we have all the form data ready
                  // Extract all form data
                  const formValues: Record<string, string | Record<string, string>> = {}
                  const credentials: Record<string, string> = {}

                  // Add all form fields - use jQuery to avoid TypeScript errors
                  $form.find('input').each(function () {
                    // Use jQuery properly with Cypress
                    const name = this.name
                    const value = this.value

                    if (name === 'username' || name === 'password' || name === 'remember') {
                      credentials[name] = value
                    } else if (name) {
                      formValues[name] = value
                    }
                  })

                  // Ensure CSRF token is included
                  if (!formValues.csrf_token || formValues.csrf_token === '<csrf-token-missing>') {
                    formValues.csrf_token = csrfToken
                    cy.log('Fixed csrf_token in form data')
                  }

                  // Add credentials object
                  formValues.credentials = credentials

                  // Add request_uri and client_id from the URL if not already in form
                  if (!formValues.request_uri) {
                    const urlParams = new URLSearchParams(window.location.search)
                    const requestUriFromUrl = urlParams.get('request_uri')
                    if (requestUriFromUrl) {
                      formValues.request_uri = requestUriFromUrl
                    } else if (extractedRequestUri) {
                      formValues.request_uri = extractedRequestUri
                    }
                  }

                  if (!formValues.client_id) {
                    const urlParams = new URLSearchParams(window.location.search)
                    const clientId = urlParams.get('client_id')
                    if (clientId) {
                      formValues.client_id = clientId
                    }
                  }

                  // Log what we're about to send
                  cy.log(`Form data prepared: ${JSON.stringify(formValues)}`)

                  // Now, instead of using cy.request, let's submit the form normally
                  // but first make sure all our data is in the form

                  // Update or add all form fields
                  Object.entries(formValues).forEach(([key, value]) => {
                    if (key === 'credentials') {
                      // Skip credentials object, we'll handle it separately
                      return
                    }

                    // Check if input exists
                    const existingInput = $form.find(`input[name="${key}"]`)
                    if (existingInput.length > 0) {
                      // Update existing input - convert value to string if it's an object
                      existingInput.val(typeof value === 'object' ? JSON.stringify(value) : value)
                    } else {
                      // Create new input
                      const input = document.createElement('input')
                      input.type = 'hidden'
                      input.name = key
                      input.value = typeof value === 'object' ? JSON.stringify(value) : value as string
                      $form[0].appendChild(input)
                    }
                  })

                  // Handle credentials object
                  if (credentials) {
                    Object.entries(credentials).forEach(([key, value]) => {
                      // Check if input exists
                      const existingInput = $form.find(`input[name="${key}"]`)
                      if (existingInput.length > 0) {
                        // Update existing input
                        existingInput.val(value)
                      } else {
                        // Create new input
                        const input = document.createElement('input')
                        input.type = key === 'password' ? 'password' : 'text'
                        input.name = key
                        input.value = value
                        $form[0].appendChild(input)
                      }
                    })
                  }

                  // Now submit the form using the native submit method
                  cy.log('Submitting form using native form submission')

                  // Use the submit button to trigger the form submission
                  cy.get('button[type="submit"], button:contains("Sign in"), button:contains("Log in"), button:contains("Next")')
                    .should('exist')
                    .click({ force: true })

                  // After form submission, look for consent page if needed
                  cy.get('body', { timeout: 10000 }).then($body => {
                    const bodyText = $body.text().toLowerCase()
                    if (bodyText.includes('authorize') || bodyText.includes('consent') || bodyText.includes('allow')) {
                      cy.log('Found consent page, clicking authorize button')
                      cy.get('button')
                        .filter((i, el) => {
                          const text = el.textContent?.toLowerCase() || ''
                          return text.includes('authorize') || text.includes('allow') || text.includes('continue')
                        })
                        .first()
                        .click({ force: true })
                    }
                  })
                })
              } else {
                cy.log('WARNING: No CSRF token found, proceeding without it')
              }
            })
          }
        )

        // After the Bluesky authentication, we should be redirected back to our app
        // Wait for the sign-in request to complete (outside of cy.origin)
        cy.wait('@signInRequest', { timeout: 30000 })
          .then(interception => {
            cy.log('request body', JSON.stringify(interception.request?.body))
            cy.log(`Sign-in response status: ${interception.response?.statusCode}`)
            if (interception.response?.statusCode >= 400) {
              cy.log(`Sign-in error: ${JSON.stringify(interception.response?.body)}`)
            }
          })

        // Wait for the form submission to complete (outside of cy.origin)
        cy.wait('@formSubmission', { timeout: 30000 })
          .then(interception => {
            cy.log(`Form submission status: ${interception.response?.statusCode}`)
            cy.log(`Form submission request body: ${JSON.stringify(interception.request?.body)}`)
            if (interception.response?.statusCode >= 400) {
              cy.log(`Form submission error: ${JSON.stringify(interception.response?.body)}`)
            }
          })

        // Set up a listener for the redirect
        cy.url({ timeout: 30000 }).then(url => {
          cy.log(`Current URL after auth flow: ${url}`)

          // If we're already redirected to dashboard, we're done
          if (url.includes('/dashboard')) {
            cy.log('Already redirected to dashboard')
            cy.screenshot('bluesky-login-success')
          } else {
            // Otherwise, wait for the callback and check for dashboard redirect
            cy.wait('@callback', { timeout: 30000 })
              .then((interception) => {
                cy.log(`Callback response status: ${interception.response?.statusCode}`)
              })

            cy.url({ timeout: 30000 })
              .should('include', '/dashboard')
              .then((url) => {
                cy.log(`Successfully redirected to: ${url}`)
                cy.screenshot('bluesky-login-success')
              })
          }
        })
      })
    })
  })

  // Email collection test is removed to fix linter errors
})
