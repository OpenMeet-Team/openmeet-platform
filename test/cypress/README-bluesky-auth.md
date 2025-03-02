# Bluesky Authentication Testing

This document provides guidance on how to use the Cypress tests for Bluesky authentication in the OpenMeet platform.

## Overview

The Bluesky authentication tests are designed to test the OAuth 2.0 flow with Bluesky's authentication service. These tests:

1. Complete the full OAuth flow with Bluesky
2. Handle CSRF token extraction and submission
3. Verify successful authentication
4. Test API calls using the obtained authentication tokens

## Test Files

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
- This token is also available in the `window.__authorizeData.csrfCookie` JavaScript object

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

### 4. Authorization Acceptance

- After successful sign-in, a request to `/oauth/authorize/accept` is made
- This request includes the same CSRF token, request URI, client ID, and account subject
- Bluesky then redirects to your callback URL with an authorization code

### 5. Callback Processing

- Your backend processes the callback and exchanges the code for tokens
- The backend redirects to your frontend with the tokens
- Your frontend stores these tokens for subsequent API calls

## Solution Approach

Our approach to testing this flow in Cypress involves:

### 1. Proper CSRF Token Extraction

We extract the CSRF token from the cookie named after the request_uri parameter.
We have a policy issue and the cookies aren't loaded, so get the set cookie header directly instead of the cookie.

Do not look for the token in the HTML, or in the window.__authorizeData.csrfCookie object, or try to use getCookie() to get it.

### 2. Correct Request Formation

We ensure all requests include the necessary parameters:
- Both `csrf_token` and `request_uri` in the sign-in request
- Proper formatting of the credentials object
- All required security headers

### 3. Handling Cross-Origin Navigation

Since Bluesky's OAuth service is on a different domain, we use:
- `cy.origin()` to handle cross-origin navigation
- Custom request handling to ensure headers are properly set
- Proper cookie handling between domains

### 4. Robust Redirect Handling

We implement robust handling of the multiple redirects in the flow:
- Following redirects from the sign-in response
- Handling the redirect to the accept endpoint
- Processing the callback redirect to your application

## Custom Commands

We've implemented several custom commands to make testing easier:

1. `cy.authenticateWithBluesky()`: Performs the complete OAuth flow with Bluesky
2. `cy.simulateBlueskyAuth()`: Simulates authentication for quick testing
3. `cy.mockBlueskyAuth()`: Mocks authentication for API testing

### Using the Custom Commands

```typescript
// Complete real OAuth flow
cy.authenticateWithBluesky()

// Simulate authentication (faster but not real)
cy.simulateBlueskyAuth()

// Mock authentication for API testing
cy.mockBlueskyAuth()
```

## Running the Tests

```bash
# Run all Bluesky tests
npx cypress run --spec "cypress/e2e/bluesky-*.cy.ts"

# Run a specific test
npx cypress run --spec "cypress/e2e/bluesky-auth-improved.cy.ts"

# Run in interactive mode
npx cypress open
```

## Troubleshooting

### Common Issues

1. **CSRF Token Not Found**: If the test fails to extract the CSRF token, try:
   - Check if the token is in `window.__authorizeData.csrfCookie`
   - Look for a cookie named after the request_uri parameter
   - Inspect the HTML for hidden form inputs with name "csrf_token"

2. **Authentication Failures**: If authentication fails:
   - Verify your credentials are correct
   - Check if all required parameters are included in the sign-in request
   - Ensure the security headers are properly set

3. **Timeouts**: If you experience timeouts:
   - Increase the timeout values in the test
   - Check network connectivity
   - Verify the Bluesky service is available

4. **Security Header Issues**: If you encounter security-related errors:
   - Ensure all `sec-fetch-*` headers are properly set
   - Check that the origin and referer headers are correct
   - Verify that cookies are being properly sent with requests

### Debugging

The tests include extensive logging to help with debugging:
- CSRF token extraction attempts
- Form submission details
- Response statuses
- Redirect URLs

Check the Cypress logs for these details when troubleshooting.

## Extending the Tests

To add more tests for Bluesky API functionality:

1. First authenticate using the existing flow or custom commands
2. Add intercepts for the specific API endpoints you want to test
3. Trigger the API calls through UI interactions
4. Verify the responses and UI updates

Example:

```typescript
it('should test a new Bluesky API feature', () => {
  // Authenticate with Bluesky
  cy.authenticateWithBluesky()

  // Intercept the API endpoint
  cy.intercept('GET', '**/api/v1/bluesky/new-feature/**').as('newFeatureRequest')

  // Trigger the API call
  cy.dataCy('new-feature-button').click()

  // Verify the response
  cy.wait('@newFeatureRequest').then((interception) => {
    const statusCode = interception.response?.statusCode || 0
    expect(statusCode).to.equal(200)
    // Additional assertions...
  })
})
```

## Implementation Notes

1. **CSRF Token Handling**: The key to successful authentication is correctly extracting and using the CSRF token from the `window.__authorizeData.csrfCookie` object or the cookie named after the request_uri.

2. **Request Parameters**: Both the `csrf_token` and `request_uri` must be included in the sign-in request, along with the client_id and credentials.

3. **Security Headers**: The `sec-fetch-*` headers are crucial for the requests to be accepted by Bluesky's servers.

4. **Cookie Management**: Proper handling of cookies between domains is essential for the authentication flow to work.

5. **Redirect Handling**: The test must properly follow all redirects in the flow, from sign-in to callback processing.

These improvements make the Bluesky authentication tests more robust and maintainable.
