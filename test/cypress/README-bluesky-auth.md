# Bluesky Authentication Testing

This document provides guidance on how to use the Cypress tests for Bluesky authentication in the OpenMeet platform.

## Overview

The Bluesky authentication tests are designed to test the OAuth 2.0 flow with Bluesky's authentication service. These tests:

1. Complete the full OAuth flow with Bluesky
2. Handle CSRF token extraction and submission
3. Verify successful authentication
4. Test API calls using the obtained authentication tokens

## Test Files

- `bluesky-auth-fixed.cy.ts`: The most reliable implementation that handles all edge cases
- `bluesky-auth-improved.cy.ts`: The main test file that implements the complete OAuth flow
- `bluesky-login-simple.cy.ts`: A simplified version of the login flow
- `bluesky-login.cy.ts`: The original implementation (for reference)
- `bluesky-auth-real.cy.ts`: Tests using real credentials (requires manual intervention)

## Environment Variables

To run these tests, you need to set the following environment variables in your Cypress environment:

```
APP_TESTING_BLUESKY_HANDLE=your.bsky.social
APP_TESTING_BLUESKY_PASSWORD=your-password
APP_TESTING_API_URL=http://localhost:3000 (or your API URL)
```

You can set these in your `cypress.env.json` file or through the command line.

## Understanding the Bluesky OAuth Flow

The Bluesky OAuth flow involves several key steps that must be handled correctly:

### 1. Initial Authorization Request

- The client initiates the flow by redirecting to Bluesky's OAuth endpoint
- The request includes a `request_uri` parameter which is crucial for CSRF protection
- Bluesky responds with an HTML page containing login form and JavaScript data

### 2. CSRF Token Mechanism

- Bluesky sets a cookie named after the `request_uri` parameter (e.g., `csrf-urn:ietf:params:oauth:request_uri:req-37775147ea2a8883981b1f08924c8dfe`)
- The value of this cookie is the actual CSRF token needed for form submission
- This token must be extracted from the Set-Cookie header in the response
- The token is also needed in the `x-csrf-token` header for subsequent requests

### 3. Sign-in Request

- The sign-in request must include:
  - `csrf_token`: The value of the CSRF cookie
  - `request_uri`: The original request URI parameter
  - `client_id`: The full client ID URL
  - `credentials`: Object with username, password, and remember flag
- The request must have proper security headers:
  - `sec-fetch-dest`: "empty"
  - `sec-fetch-mode`: "same-origin"
  - `sec-fetch-site`: "same-origin"
  - `cookie`: Must include device-id, session-id, and the CSRF cookie
  - `x-csrf-token`: Must match the CSRF token value

### 4. Authorization Acceptance

- After successful sign-in, a request to `/oauth/authorize/accept` is made
- This request includes the same CSRF token, request URI, and client ID
- The same headers and cookies must be included as in the sign-in request
- Bluesky then redirects to your callback URL with an authorization code

### 5. Callback Processing

- Your backend processes the callback and exchanges the code for tokens
- The backend redirects to your frontend with the tokens
- Your frontend stores these tokens for subsequent API calls

## Solution Approach in bluesky-auth-fixed.cy.ts

Our approach to testing this flow in Cypress involves:

### 1. Robust CSRF Token Extraction

We extract the CSRF token from the Set-Cookie header in one way:
- Look for an exact match using the request_uri parameter
- use the set cookie headers instead of using getCookie()


```typescript
// Example of extracting the CSRF token from Set-Cookie header
const setCookieHeader = res.headers['set-cookie']
if (setCookieHeader) {
  allCookies = Array.isArray(setCookieHeader) ? setCookieHeader.join('; ') : setCookieHeader.toString()

  if (requestUri) {
    const csrfCookieRegex = new RegExp(`csrf-${requestUri.replace(/:/g, '\\:').replace(/\./g, '\\.').replace(/\//g, '\\/')}=([^;]+)`)
    const csrfCookieMatch = allCookies.match(csrfCookieRegex)

    if (csrfCookieMatch) {
      storedCsrfToken = csrfCookieMatch[1]
    }
  }
}
```

### 2. Complete Cookie Management

We capture and manage all necessary cookies:
- `device-id`: Required for session tracking
- `session-id`: Required for authentication
- `csrf-{request_uri}`: Required for CSRF protection

```typescript
// Example of building a cookie header
let cookieHeader = ''
if (deviceIdCookie) {
  cookieHeader += `device-id=${deviceIdCookie}; `
}
if (sessionIdCookie) {
  cookieHeader += `session-id=${sessionIdCookie}; `
}
cookieHeader += `csrf-${requestUri}=${storedCsrfToken}`
```

### 3. Proper Request Formation

We ensure all requests include the necessary parameters and headers:

```typescript
// Example of setting up the sign-in request
req.headers = {
  ...req.headers,
  cookie: cookieHeader,
  'x-csrf-token': storedCsrfToken,
  'sec-fetch-mode': 'same-origin',
  'sec-fetch-site': 'same-origin',
  'sec-fetch-dest': 'empty',
  'content-type': 'application/json',
  accept: '*/*',
  origin: 'https://bsky.social',
  referer: `https://bsky.social/oauth/authorize?client_id=${encodeURIComponent(clientId)}&request_uri=${encodeURIComponent(requestUri)}`,
}

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
```

### 4. Cross-Origin Handling with Data Passing

We use `cy.origin()` with all necessary data passed as arguments:

```typescript
cy.origin(authOrigin, { args: { authUrl, password: Cypress.env('APP_TESTING_BLUESKY_PASSWORD'), requestUri, clientId, storedCsrfToken, deviceIdCookie, sessionIdCookie } },
  ({ authUrl, password, requestUri, clientId, storedCsrfToken, deviceIdCookie, sessionIdCookie }) => {
    // Handle the authentication flow in the origin context
  }
)
```

### 5. Form Manipulation for CSRF Token

We ensure the CSRF token is properly set in forms before submission:

```typescript
cy.document().then(doc => {
  const form = doc.querySelector('form')
  if (form && storedCsrfToken) {
    // Look for the csrf_token input field
    const csrfInput = form.querySelector('input[name="csrf_token"]') as HTMLInputElement
    if (csrfInput) {
      csrfInput.value = storedCsrfToken
    } else {
      // If no csrf_token input exists, create one
      const newCsrfInput = document.createElement('input')
      newCsrfInput.type = 'hidden'
      newCsrfInput.name = 'csrf_token'
      newCsrfInput.value = storedCsrfToken
      form.appendChild(newCsrfInput)
    }
  }
})
```

### 6. Handling Quasar-Specific Storage Format

We properly handle Quasar's special string format in localStorage:

```typescript
// Handle Quasar's special string format if present
if (userDataRaw.startsWith('__q_strn|')) {
  // Extract the JSON part after the prefix
  userData = JSON.parse(userDataRaw.substring(9))
} else {
  // Parse as regular JSON
  userData = JSON.parse(userDataRaw)
}
```

## Running the Tests

```bash
# Run the fixed Bluesky test
npx cypress run --spec "cypress/e2e/bluesky-auth-fixed.cy.ts" --browser chromium --headed --no-exit

# Run all Bluesky tests
npx cypress run --spec "cypress/e2e/bluesky-*.cy.ts"

# Run in interactive mode
npx cypress open
```

## Troubleshooting

### Common Issues

1. **CSRF Token Not Found**: If the test fails to extract the CSRF token:
   - Check the Set-Cookie header in the response
   - Try both exact and generic regex patterns
   - Make a direct request to the OAuth URL to get fresh cookies

2. **Authentication Failures**: If authentication fails:
   - Ensure all cookies are properly captured and included
   - Verify the x-csrf-token header is set correctly
   - Check that the request body includes csrf_token, request_uri, and client_id

3. **Form Submission Issues**: If form submission fails:
   - Ensure the CSRF token is set in the form before submission
   - Create a hidden input field if one doesn't exist
   - Set cookies in the browser context before clicking buttons

4. **Cross-Origin Problems**: If cross-origin navigation fails:
   - Pass all necessary data as arguments to cy.origin()
   - Set up all intercepts before calling cy.origin()
   - Use proper security headers for each request

5. **Timeout Errors**: If you experience timeouts:
   - Increase the timeout values in the test
   - Add error handling for specific timeout scenarios
   - Check if the test succeeded despite the timeout

### Debugging

The fixed test includes extensive logging to help with debugging:
- Prominent logging of CSRF token extraction with asterisk highlighting
- Detailed logging of request headers and bodies
- Logging of form fields and actions
- Verification of localStorage data after authentication

Example of enhanced logging:
```typescript
cy.log('*************************************')
cy.log(`***** CSRF TOKEN FOUND (EXACT MATCH): ${storedCsrfToken} *****`)
cy.log('*************************************')
```

## Extending the Tests

To add more tests for Bluesky API calls after authentication:

```typescript
it('should be able to make Bluesky API calls after authentication', () => {
  // First authenticate with Bluesky
  cy.visit('/auth/login')
  // ... authentication steps ...

  // Verify we're on the dashboard
  cy.url().should('include', '/dashboard')

  // Now test making Bluesky API calls
  cy.intercept('GET', '**/api/v1/bluesky/profile/**').as('blueskyProfileRequest')
  cy.dataCy('bluesky-profile-button').click()

  // Verify the response
  cy.wait('@blueskyProfileRequest').then((interception) => {
    const statusCode = interception.response?.statusCode || 0
    expect(statusCode).to.be.oneOf([200, 304])

    // Verify the UI updates
    cy.dataCy('bluesky-profile-container').within(() => {
      cy.contains(Cypress.env('APP_TESTING_BLUESKY_HANDLE')).should('exist')
    })
  })
})
```

## Implementation Notes

1. **Error Handling**: The fixed test includes robust error handling, especially for timeout errors that might occur during the callback phase.

2. **Multiple Token Extraction Methods**: We use multiple approaches to extract the CSRF token to ensure reliability.

3. **Direct Form Manipulation**: We directly manipulate the DOM to ensure the CSRF token is properly set in forms.

4. **Comprehensive Verification**: We verify authentication success by checking localStorage data, including handling Quasar's special string format.

5. **Flexible Window.open Handling**: We handle both cases where window.open is called and where it isn't, making the test more robust.

These improvements make the Bluesky authentication tests more reliable and maintainable, even when the Bluesky OAuth implementation changes.
