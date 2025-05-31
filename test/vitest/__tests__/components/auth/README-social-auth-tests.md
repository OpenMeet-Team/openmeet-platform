# Social Authentication Error Handling Tests

This directory contains comprehensive unit tests for the enhanced social authentication error handling system.

## Test Files

### `SocialAuthError.test.ts`
Tests the reusable `SocialAuthError` component that displays enhanced error messages for social authentication conflicts.

**Coverage:**
- Basic rendering (error messages, icons, buttons)
- Enhanced error display with provider suggestions
- Provider-specific buttons (Google, GitHub, Bluesky, Email)
- Event emissions (tryAgain, cancel, useProvider, useEmailLogin)
- Error message parsing and cleanup
- Button text and styling validation

### `useSocialAuthError.test.ts`
Tests the `useSocialAuthError` composable that manages social authentication error state and parsing.

**Coverage:**
- Error parsing for enhanced API responses
- 422 email conflict error handling
- Provider suggestion extraction from error messages
- Error state management (set, clear, computed properties)
- Navigation helpers
- Popup handling and messaging
- Edge cases (null/undefined errors, malformed responses)

### Integration Testing
The enhanced social auth error handling is also manually tested within the actual authentication components:
- `GoogleLoginComponent.vue` - Enhanced error display for Google One Tap
- `GithubCallbackPage.vue` - Enhanced error display for GitHub OAuth callback  
- `AuthBlueskyCallbackPage.vue` - Enhanced error display for Bluesky OAuth callback

These components now use the `SocialAuthError` component and `useSocialAuthError` composable for consistent error handling.

## Test Patterns

### Error Types Tested
1. **Enhanced API Errors**: Structured responses with `social_auth`, `auth_provider`, `suggested_provider`
2. **422 Email Conflicts**: Standard validation errors with provider hints in message
3. **Generic Errors**: Network errors, server errors, malformed responses
4. **Edge Cases**: Null, undefined, partial data

### Mock Strategies
- Router mocking for navigation testing
- Window object mocking for popup behavior
- Auth store mocking for API call simulation
- Event emission verification

### Assertions
- Component rendering and content
- Event emissions with correct payloads
- Error state management
- Navigation calls
- User guidance messages

## Running Tests

```bash
# Run all social auth error tests
npm run test:unit -- --run SocialAuthError useSocialAuthError

# Run specific test file
npm run test:unit -- --run test/vitest/__tests__/components/auth/SocialAuthError.test.ts

# Run with coverage
npm run test:unit -- --coverage SocialAuthError
```

## Test Quality

- **37 total tests** across core functionality
- **100% lint compliance** with project standards
- **Type safety** with proper TypeScript mocking
- **Comprehensive edge cases** for robust error handling
- **Real-world integration** via enhanced auth components