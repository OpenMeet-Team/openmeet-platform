# OpenMeet Platform Acceptance Tests

This directory contains comprehensive end-to-end acceptance tests for the OpenMeet platform. These tests are designed to verify major functionality and integration points before deploying to production.

## Overview

The acceptance tests are structured to:
- Use real API endpoints and external services (email, Matrix chat, etc.)
- Only use test email addresses matching `openmeet-test.*@openmeet.net` pattern
- Test critical user journeys and integrations
- Validate performance thresholds
- Provide different test suites for different environments

## Test Structure

### Full Acceptance Tests (`acceptance-full-flow.cy.ts`)
Comprehensive tests covering:
- User registration and authentication
- Event creation, editing, and management
- Event attendance and approval workflows
- Group creation and member management
- Matrix chat integration
- Search and discovery
- Calendar integration
- Email notifications
- Mobile responsiveness
- Performance monitoring

### Smoke Tests (`acceptance-smoke-tests.cy.ts`)
Minimal, read-only tests for production:
- Page load verification
- API health checks
- Basic navigation
- Error handling
- Security headers
- Performance budgets

## Environment Configuration

### Test Email Pattern
All test accounts use the pattern: `openmeet-test.*@openmeet.net`

Examples:
- `openmeet-test.organizer-1234567890@openmeet.net`
- `openmeet-test.attendee-1234567890@openmeet.net`
- `openmeet-test.dev-user-1234567890@openmeet.net`

This ensures:
- No real users receive test emails
- Real email server is tested
- Easy identification of test accounts for cleanup

### Environment Setup

#### Configuration System

The acceptance tests use a layered configuration system:

1. **Default configurations** in `acceptance-test.config.ts`
2. **Environment-specific overrides** in `env.json` (created from `env.example.json`)
3. **Runtime environment variables** (highest priority)

#### Setup Steps

1. Copy the example environment file:
```bash
cp test/cypress/config/env.example.json test/cypress/config/env.json
```

2. Update `env.json` with actual values for your environments:

```json
{
  "dev": {
    "apiUrl": "https://api-dev.openmeet.net",
    "baseUrl": "https://platform-dev.openmeet.net",
    "tenantId": "lsdfaopkljdfs",
    "emailConfig": {
      "imapHost": "mail.openmeet.net",
      "monitoringEmail": "monitor@openmeet.net",
      "monitoringPassword": "your-actual-password"
    },
    "cypressEnv": {
      "APP_TESTING_API_URL": "https://api-dev.openmeet.net",
      "APP_TESTING_USER_EMAIL": "openmeet-test.user@openmeet.net",
      "APP_TESTING_USER_PASSWORD": "your-actual-password"
    }
  }
}
```

3. Set environment variables in your CI/CD pipeline (these override env.json):
```bash
# For dev environment tests
export CYPRESS_ENV=dev
export APP_TESTING_USER_PASSWORD="secure-password-from-vault"
export DEV_MONITORING_PASSWORD="monitoring-password-from-vault"
```

#### Configuration Priority

1. **Runtime environment variables** (highest priority)
2. **env.json cypressEnv section** for Cypress-specific settings
3. **env.json main section** for acceptance test config  
4. **Default configurations** in acceptance-test.config.ts (lowest priority)

## Running Tests

### Local Development
```bash
# Run full acceptance tests against local environment
npm run test:e2e:acceptance:local

# This will:
# - Start the local Quasar dev server
# - Run acceptance tests against localhost
# - Use maildev for email testing
```

### Development Environment
```bash
# Run against dev environment (manual trigger)
npm run test:e2e:acceptance:dev

# This will:
# - Run tests against https://platform-dev.openmeet.net
# - Use real email server for testing
# - Validate performance thresholds
```

### Staging Environment
```bash
# Run against staging environment
npm run test:e2e:acceptance:staging

# Similar to dev but against staging URLs
```

### Production Smoke Tests
```bash
# Run minimal smoke tests against production
npm run test:e2e:acceptance:prod

# This will:
# - Run read-only tests only
# - Not create or modify data
# - Check basic functionality and performance
```

## CI/CD Integration

### Pre-deployment Pipeline
These tests should be run before deploying to production:

```yaml
# Example GitHub Actions workflow
acceptance-tests:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v3
    - uses: actions/setup-node@v3
    
    - name: Install dependencies
      run: npm ci
      
    - name: Run acceptance tests against dev
      env:
        CYPRESS_ENV: dev
        APP_TESTING_API_URL: https://api-dev.openmeet.net
        APP_TESTING_TENANT_ID: lsdfaopkljdfs
        APP_TESTING_USER_EMAIL: ${{ secrets.DEV_TEST_USER_EMAIL }}
        APP_TESTING_USER_PASSWORD: ${{ secrets.DEV_TEST_USER_PASSWORD }}
      run: npm run test:e2e:acceptance:dev
      
    - name: Upload test artifacts
      uses: actions/upload-artifact@v3
      if: failure()
      with:
        name: cypress-videos
        path: test/cypress/videos
```

### Post-deployment Verification
After deployment to production:

```yaml
production-smoke-tests:
  runs-on: ubuntu-latest
  needs: deploy-production
  steps:
    - name: Run production smoke tests
      env:
        CYPRESS_ENV: prod
        PROD_MONITORING_EMAIL: ${{ secrets.PROD_MONITORING_EMAIL }}
        PROD_MONITORING_PASSWORD: ${{ secrets.PROD_MONITORING_PASSWORD }}
      run: npm run test:e2e:acceptance:prod
```

## Email Testing

### Local Development (Maildev)
- Uses local Maildev instance at http://localhost:1080
- All emails captured locally
- View emails at http://localhost:1080

### Dev/Staging (Real Email Server)
- Uses real email server
- Test emails sent to `openmeet-test.*@openmeet.net`
- IMAP connection for verification (configure in env.json)

### Production (Monitoring Only)
- No test emails sent
- Monitor existing email functionality
- Use read-only monitoring accounts

## Performance Monitoring

Tests include performance validation:

### Thresholds
- Page load: < 3000ms (dev/staging), < 2000ms (production)
- API response: < 2000ms (dev/staging), < 1000ms (production)
- First Contentful Paint: < 1500ms
- Largest Contentful Paint: < 2500ms

### Metrics Collected
- Page load times
- API response times
- Core Web Vitals
- Resource load times

### Configuration
Set `FAIL_ON_PERFORMANCE_ISSUES=true` to fail tests when thresholds are exceeded.

## Test Data Management

### Creation
- Tests create temporary test data (users, groups, events)
- All test entities use timestamp-based unique names
- Test users follow the email pattern

### Cleanup
- Tests clean up created data after completion
- Failed tests may leave orphaned data
- Regular cleanup scripts should remove old test data

### Isolation
- Each test run uses unique timestamps
- Tests don't depend on existing data
- Parallel test runs don't interfere

## Troubleshooting

### Common Issues

1. **Authentication Failures**
   - Check API URL and tenant ID
   - Verify test user credentials
   - Ensure test users exist in target environment

2. **Email Verification Failures**
   - Check email testing mode configuration
   - Verify IMAP credentials for dev/staging
   - Ensure maildev is running for local tests

3. **Performance Test Failures**
   - Check network conditions
   - Verify performance thresholds are realistic
   - Look for slow API endpoints or resources

4. **Matrix Chat Issues**
   - Verify Matrix server is running
   - Check WebSocket connections
   - Ensure test users are provisioned in Matrix

### Debug Mode
Run tests with debug output:
```bash
DEBUG=cypress:* npm run test:e2e:acceptance:dev
```

### Headful Mode
See tests running in browser:
```bash
CYPRESS_ENV=dev cypress open --e2e --spec "test/cypress/e2e/acceptance-*.cy.ts"
```

## Contributing

### Adding New Tests
1. Follow existing patterns in `acceptance-full-flow.cy.ts`
2. Use `openmeet-test.*@openmeet.net` email pattern
3. Include proper cleanup
4. Add performance monitoring where appropriate
5. Test against multiple environments

### Test Guidelines
- Tests should be independent and idempotent
- Use descriptive test names and comments
- Include both positive and negative test cases
- Verify error handling and edge cases
- Consider mobile and accessibility scenarios

### Environment-Specific Behavior
Use feature flags to control behavior:
```typescript
if (isFeatureEnabled('testUserRegistration', config)) {
  // Create test users
} else {
  // Use existing monitoring accounts
}
```

## Monitoring and Reporting

### Test Results
- Tests output performance metrics
- Screenshots and videos captured on failure
- Results can be integrated with monitoring systems

### Alerting
Set up alerts for:
- Test failures in dev/staging environments
- Performance degradation
- High error rates in smoke tests

### Metrics Integration
Performance data can be sent to:
- Application Performance Monitoring (APM) tools
- Custom dashboards
- Alerting systems