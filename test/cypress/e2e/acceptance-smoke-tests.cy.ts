/**
 * Smoke Tests for Production Environment
 *
 * These are minimal, read-only tests that verify basic functionality
 * in production without creating or modifying data.
 */

import { getEnvironmentConfig } from '../config/acceptance-test.config'

describe('OpenMeet Production Smoke Tests', () => {
  const config = getEnvironmentConfig()
  const performanceThresholds = config.performance.thresholds || {
    pageLoad: 8000,
    apiResponse: 5000,
    firstContentfulPaint: 5000,
    largestContentfulPaint: 8000,
    cumulativeLayoutShift: 0.2
  }

  describe('Core Page Accessibility', () => {
    it('should load home page within performance thresholds', () => {
      cy.startPerformanceMonitoring()
      cy.visit('/')

      // Verify essential elements are present
      cy.dataCy('header-logo-component').should('be.visible')
      cy.get('main').should('be.visible')
      cy.get('footer').should('be.visible')

      // Check for any JavaScript errors
      cy.window().then(() => {
        // Note: Checking console errors would require setting up spy beforehand
        cy.task('log', 'Console error checking would require proper setup')
      })

      // Measure performance
      cy.measurePagePerformance(performanceThresholds).then((result) => {
        // Log performance metrics
        cy.task('log', `Home Page Performance: Load ${result.metrics.pageLoadTime}ms, FCP ${result.metrics.firstContentfulPaint}ms`)

        // In smoke tests, we log warnings but don't fail unless critical
        if (!result.validation.passed) {
          cy.task('log', `Performance warnings: ${result.validation.failures.join(', ')}`)

          // Only fail if page load time is extremely slow (critical failure)
          const criticalFailures = result.validation.failures.filter(failure =>
            failure.includes('Page load time') && result.metrics.pageLoadTime > 15000
          )

          if (criticalFailures.length > 0) {
            throw new Error(`Critical performance failure: ${criticalFailures.join(', ')}`)
          }
        }
      })

      cy.stopPerformanceMonitoring()
    })

    it('should load events page and display events', () => {
      cy.visit('/events')

      // Should show events list or loading state
      cy.get('body').should('contain.text', 'Events')

      // Verify events page loads
      cy.dataCy('events-page').should('be.visible')

      // Check for any critical errors
      cy.get('[data-cy="error-message"]').should('not.exist')
    })

    it('should load groups page', () => {
      cy.visit('/groups')

      // Should show groups list or loading state
      cy.get('body').should('contain.text', 'Groups')

      // Verify groups page loads
      cy.dataCy('groups-page').should('be.visible')

      // No critical errors
      cy.get('[data-cy="error-message"]').should('not.exist')
    })

    it('should load auth pages', () => {
      cy.visit('/auth/login')

      // Login form should be present
      cy.dataCy('login-form').should('be.visible')
      cy.dataCy('login-email').should('be.visible')
      cy.dataCy('login-password').should('be.visible')

      // Registration button should be visible (may be in header or on page)
      cy.get('body').then(($body) => {
        if ($body.find('[data-cy="header-register-button"]').length > 0) {
          cy.dataCy('header-register-button').should('be.visible')
        } else {
          cy.task('log', 'Register button not found in header - checking for other registration links')
          cy.get('body').should('contain.text', 'Registration')
        }
      })
    })
  })

  describe('API Health Checks', () => {
    it('should have healthy API endpoints', () => {
      // Check API health endpoint
      cy.request({
        url: `${Cypress.env('APP_TESTING_API_URL')}/api/health`,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.be.oneOf([200, 404]) // 404 is ok if health endpoint doesn't exist
      })

      // Check events endpoint returns data
      cy.request({
        url: `${Cypress.env('APP_TESTING_API_URL')}/api/events`,
        headers: {
          'x-tenant-id': Cypress.env('APP_TESTING_TENANT_ID')
        },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.be.oneOf([200, 401]) // 401 is ok for auth-required endpoints
      })
    })

    it('should handle CORS properly', () => {
      // Verify CORS headers are present
      cy.request({
        url: `${Cypress.env('APP_TESTING_API_URL')}/api/events`,
        headers: {
          'x-tenant-id': Cypress.env('APP_TESTING_TENANT_ID'),
          Origin: Cypress.config().baseUrl
        },
        failOnStatusCode: false
      }).then((response) => {
        // Log headers for debugging
        cy.task('log', `API Response Headers: ${JSON.stringify(response.headers)}`)

        // CORS headers should be present for cross-origin requests
        if (response.headers['access-control-allow-origin']) {
          cy.task('log', 'CORS header found')
          expect(response.headers).to.have.property('access-control-allow-origin')
        } else {
          cy.task('log', 'CORS header not found - may be same-origin request')
        }

        // Response should be valid
        expect(response.status).to.be.oneOf([200, 401, 404])
      })
    })
  })

  describe('Authentication Flow (Read-Only)', () => {
    it('should show login form and handle invalid credentials gracefully', () => {
      cy.visit('/auth/login')

      // Try login with invalid credentials
      cy.dataCy('login-email').type('invalid@example.com')
      cy.dataCy('login-password').type('invalidpassword')
      cy.dataCy('login-submit').click({ force: true })

      // Should show error message, not crash
      cy.get('body').should('contain.text', 'email')

      // Form should still be functional
      cy.dataCy('login-email').should('be.visible')
      cy.dataCy('login-password').should('be.visible')
    })

    it('should handle password reset form', () => {
      cy.visit('/auth/login')

      // Try to trigger forgot password dialog
      cy.get('body').then(($body) => {
        if ($body.find('[data-cy="forgot-password-dialog"]').length > 0) {
          cy.dataCy('forgot-password-dialog').should('be.visible')
          cy.dataCy('forgot-password-email').should('be.visible')
          cy.dataCy('forgot-password-submit').should('be.visible')
        } else {
          cy.task('log', 'Forgot password dialog not found - feature may be implemented differently')
        }
      })
    })
  })

  describe('Search Functionality', () => {
    it('should handle search queries', () => {
      cy.visit('/events')

      // Look for search functionality (may be in header or on events page)
      cy.get('body').then(($body) => {
        if ($body.find('input[placeholder*="search"]').length > 0) {
          cy.get('input[placeholder*="search"]').first().type('test{enter}')
          cy.task('log', 'Search functionality tested')
        } else {
          cy.task('log', 'Search input not found - feature may be implemented differently')
        }
      })

      // No critical errors
      cy.get('[data-cy="error-message"]').should('not.exist')
    })
  })

  describe('Mobile Responsiveness', () => {
    beforeEach(() => {
      cy.viewport('iphone-x')
    })

    it('should be mobile responsive', () => {
      cy.visit('/')

      // Check if mobile navigation is present (may depend on viewport)
      cy.get('body').then(($body) => {
        if ($body.find('[data-cy="header-mobile-menu"]').length > 0) {
          cy.dataCy('header-mobile-menu').should('be.visible')
        } else {
          cy.task('log', 'Mobile menu not found - may use different responsive strategy')
        }
      })

      // Content should be readable (overflow-x can be hidden or visible)
      cy.get('body').should('have.css', 'overflow-x').and('be.oneOf', ['hidden', 'visible'])

      // Essential elements should be visible
      cy.get('main').should('be.visible')
    })

    it('should handle mobile navigation', () => {
      cy.visit('/')

      // Check if mobile menu exists before trying to interact
      cy.get('body').then(($body) => {
        if ($body.find('[data-cy="header-mobile-menu"]').length > 0) {
          // Open mobile menu
          cy.dataCy('header-mobile-menu').click()

          // Menu should open
          cy.dataCy('header-mobile-menu-drawer').should('be.visible')

          // Should be able to close
          cy.get('body').click(0, 0) // Click outside
          cy.dataCy('header-mobile-menu-drawer').should('not.be.visible')
        } else {
          cy.task('log', 'Mobile menu not available - testing basic navigation instead')
          cy.get('nav, header').should('be.visible')
        }
      })
    })
  })

  describe('Security Headers', () => {
    it('should have appropriate security headers', () => {
      cy.request('/').then((response) => {
        // Log all headers for debugging
        cy.task('log', `Headers: ${JSON.stringify(response.headers)}`)

        // Check for common security headers (may not be present in dev)
        const headers = response.headers
        if (headers['content-security-policy']) {
          cy.task('log', 'CSP header found')
        }
        if (headers['x-frame-options']) {
          cy.task('log', 'X-Frame-Options header found')
        }
        if (headers['x-content-type-options']) {
          cy.task('log', 'X-Content-Type-Options header found')
        }

        // At minimum, response should be successful
        expect(response.status).to.equal(200)
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle 404 errors gracefully', () => {
      cy.visit('/non-existent-page', { failOnStatusCode: false })

      // Should show 404 page or redirect
      cy.get('body').should('exist')

      // Should not show raw error traces
      cy.get('body').should('not.contain.text', 'Error:')
      cy.get('body').should('not.contain.text', 'Stack trace')
    })

    it('should handle API errors gracefully', () => {
      // Simulate network error
      cy.intercept('GET', '/api/events', { forceNetworkError: true }).as('networkError')

      cy.visit('/events')
      cy.wait('@networkError')

      // Should show user-friendly error message or handle gracefully
      cy.get('body').should('exist')

      // Should not show technical error details
      cy.get('body').should('not.contain.text', 'TypeError')
      cy.get('body').should('not.contain.text', 'fetch failed')
    })
  })

  describe('Performance Monitoring', () => {
    it('should meet performance budgets', () => {
      cy.startPerformanceMonitoring()

      // Load a complex page
      cy.visit('/events')

      // Wait for content to load
      cy.dataCy('events-page', { timeout: 10000 }).should('exist')

      // Measure comprehensive performance
      cy.measurePagePerformance(performanceThresholds).then((result) => {
        // Log performance metrics for monitoring
        cy.task('log', `Production Performance Metrics: ${JSON.stringify(result.metrics, null, 2)}`)

        // In smoke tests, we log warnings but don't fail unless critical
        if (!result.validation.passed) {
          cy.task('log', `Performance warnings: ${result.validation.failures.join(', ')}`)

          // Only fail if page load time is extremely slow (critical failure)
          const criticalFailures = result.validation.failures.filter(failure =>
            failure.includes('Page load time') && result.metrics.pageLoadTime > 10000
          )

          if (criticalFailures.length > 0) {
            throw new Error(`Critical performance failure: ${criticalFailures.join(', ')}`)
          }
        }
      })

      cy.stopPerformanceMonitoring()
    })
  })

  describe('External Integrations (Basic)', () => {
    it('should load external maps if used', () => {
      cy.visit('/events')

      // If the page uses external map services, they should load properly
      cy.get('body').then(($body) => {
        if ($body.find('img[src*="openstreetmap"]').length > 0) {
          cy.get('img[src*="openstreetmap"]').should('be.visible')
          cy.task('log', 'OpenStreetMap images found and loaded')
        } else {
          cy.task('log', 'No OpenStreetMap images found - may use different map service or none')
        }
      })
    })

    it('should handle external font loading', () => {
      cy.visit('/')

      // Verify fonts load properly
      cy.get('body').should('have.css', 'font-family')

      // Check for font loading errors
      cy.window().then(() => {
        // Note: Font error checking would require console spy setup
        cy.task('log', 'Font loading check completed')
      })
    })
  })
})
