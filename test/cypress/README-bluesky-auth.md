# Bluesky Authentication Testing

This document provides guidance on testing the OAuth 2.0 flow with Bluesky's authentication service in the OpenMeet platform.

## Overview

The Bluesky authentication tests verify:

1. The complete OAuth flow with Bluesky
2. CSRF token extraction and submission
3. Successful authentication and token storage
4. API calls using the obtained authentication tokens

## Environment Variables

Required environment variables:

```
APP_TESTING_BLUESKY_HANDLE=your.bsky.social
APP_TESTING_BLUESKY_PASSWORD=your-password
APP_TESTING_API_URL=http://localhost:3000 (or your API URL)
```

## Understanding the Bluesky OAuth Flow

### 1. Initial Authorization Request

- Client redirects to Bluesky's OAuth endpoint with a `request_uri` parameter for CSRF protection
- Bluesky responds with a login form

### 2. CSRF Token Mechanism

- Bluesky sets a cookie named after the `request_uri` parameter (e.g., `csrf-urn:ietf:params:oauth:request_uri:req-37775147ea2a8883981b1f08924c8dfe`)
- This cookie value is the CSRF token needed for form submission
- The token must be extracted from the Set-Cookie header and included in subsequent requests

### 3. Sign-in Request

- Must include:
  - `csrf_token`: The CSRF cookie value
  - `request_uri`: The original request URI parameter
  - `client_id`: The client ID URL
  - `credentials`: Object with username, password
- Required headers:
  - `sec-fetch-mode`: "same-origin"
  - `cookie`: Must include device-id, session-id, and CSRF cookie
  - `x-csrf-token`: Must match the CSRF token value

### 4. Authorization Acceptance

- After sign-in, a request to `/oauth/authorize/accept` is made with the CSRF token
- Bluesky redirects to your callback URL with an authorization code

### 5. Callback Processing

- Backend exchanges the code for tokens
- Frontend stores these tokens for API calls

## Key Implementation Details

### CSRF Token Extraction

```typescript
// Extract the CSRF token from Set-Cookie header
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

### Form Manipulation for CSRF Token

```typescript
// Set the CSRF token in the form before submission
cy.document().then(doc => {
  const form = doc.querySelector('form')
  if (form && storedCsrfToken) {
    // Look for the csrf_token input field
    const csrfInput = form.querySelector('input[name="csrf_token"]') as HTMLInputElement
    if (csrfInput) {
      csrfInput.value = storedCsrfToken
    } else {
      // Create a new input if it doesn't exist
      const input = doc.createElement('input')
      input.type = 'hidden'
      input.name = 'csrf_token'
      input.value = storedCsrfToken
      form.appendChild(input)
    }
  }
})
```

### Cross-Origin Handling

```typescript
// Pass all necessary data to cy.origin()
cy.origin(authOrigin,
  { args: { authUrl, password, requestUri, clientId, storedCsrfToken, deviceIdCookie, sessionIdCookie } },
  ({ authUrl, password, requestUri, clientId, storedCsrfToken, deviceIdCookie, sessionIdCookie }) => {
    // Handle authentication in the origin context
  }
)
```

## Running the Tests

```bash
# Run the Bluesky login test
npx cypress run --spec 'test/cypress/e2e/bluesky-login.cy.ts' --browser chromium --headed --no-exit
```

## Troubleshooting

### Common Issues

1. **CSRF Token Not Found**:
   - Check the Set-Cookie header in the response
   - Verify the regex pattern matches the request_uri format

2. **Authentication Failures**:
   - Ensure all cookies are properly included
   - Verify the x-csrf-token header is set correctly
   - Check that the request body includes csrf_token

3. **Form Submission Issues**:
   - Ensure the CSRF token is set in the form before submission
   - Create a hidden input field if one doesn't exist

4. **Cross-Origin Problems**:
   - Pass all necessary data as arguments to cy.origin()
   - Use proper security headers for each request

## Implementation Notes

1. **Security Headers**: Different endpoints require different sec-fetch-mode values:
   - Use "same-origin" for sign-in requests
   - Use "navigate" for OAuth and accept requests

2. **Cookie Management**: All three cookies must be included:
   - device-id
   - session-id
   - csrf-{request_uri}

3. **Form Submission**: Use button clicks rather than direct fetch calls for more reliable testing

4. **Window Handling**: The implementation handles both popup and direct navigation approaches
