/**
 * Performance monitoring helpers for acceptance tests
 *
 * These helpers track page load times, API response times, and other
 * performance metrics to ensure the platform meets performance standards.
 */

/// <reference types="cypress" />

interface PerformanceMetrics {
  pageLoadTime: number
  domContentLoadedTime: number
  firstContentfulPaint?: number
  largestContentfulPaint?: number
  cumulativeLayoutShift?: number
  apiResponseTimes: Record<string, number>
  resourceLoadTimes: Record<string, number>
}

interface PerformanceThresholds {
  pageLoad: number
  apiResponse: number
  firstContentfulPaint: number
  largestContentfulPaint: number
  cumulativeLayoutShift: number
}

/**
 * Default performance thresholds (in milliseconds)
 */
export const defaultThresholds: PerformanceThresholds = {
  pageLoad: 3000,
  apiResponse: 2000,
  firstContentfulPaint: 1500,
  largestContentfulPaint: 2500,
  cumulativeLayoutShift: 0.1
}

/**
 * Track page performance metrics
 */
export function trackPagePerformance () {
  return cy.window().then((win): PerformanceMetrics => {
    const navigation = win.performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    const paint = win.performance.getEntriesByType('paint')

    const metrics: PerformanceMetrics = {
      pageLoadTime: navigation.loadEventEnd - navigation.fetchStart,
      domContentLoadedTime: navigation.domContentLoadedEventEnd - navigation.fetchStart,
      apiResponseTimes: {},
      resourceLoadTimes: {}
    }

    // First Contentful Paint
    const fcp = paint.find(entry => entry.name === 'first-contentful-paint')
    if (fcp) {
      metrics.firstContentfulPaint = fcp.startTime
    }

    // Largest Contentful Paint (if available)
    if ('PerformanceObserver' in win) {
      // This would be set by a performance observer in the actual app
      const lcpElement = win.document.querySelector('[data-lcp]')
      if (lcpElement) {
        metrics.largestContentfulPaint = parseFloat(lcpElement.getAttribute('data-lcp-time') || '0')
      }
    }

    // Get resource timings
    const resources = win.performance.getEntriesByType('resource') as PerformanceResourceTiming[]
    resources.forEach(resource => {
      const url = new URL(resource.name)
      const key = `${url.pathname}${url.search}`
      metrics.resourceLoadTimes[key] = resource.responseEnd - resource.requestStart
    })

    return metrics
  })
}

/**
 * Monitor API response times during test execution
 */
export function monitorApiPerformance () {
  const apiTimes: Record<string, number> = {}

  // Intercept all API calls
  cy.intercept('**', (req) => {
    const startTime = Date.now()
    req.continue(() => {
      const endTime = Date.now()
      const duration = endTime - startTime
      const endpoint = `${req.method} ${req.url.split('?')[0]}`
      apiTimes[endpoint] = duration

      // Log slow API calls
      if (duration > 2000) {
        cy.task('log', `Slow API call detected: ${endpoint} took ${duration}ms`)
      }
    })
  }).as('apiCalls')

  // Store API times for later retrieval
  cy.wrap(apiTimes).as('apiResponseTimes')
}

/**
 * Check if performance metrics meet thresholds
 */
export function validatePerformance (metrics: PerformanceMetrics, thresholds: PerformanceThresholds = defaultThresholds) {
  const failures: string[] = []

  if (metrics.pageLoadTime > thresholds.pageLoad) {
    failures.push(`Page load time ${metrics.pageLoadTime}ms exceeds threshold ${thresholds.pageLoad}ms`)
  }

  if (metrics.firstContentfulPaint && metrics.firstContentfulPaint > thresholds.firstContentfulPaint) {
    failures.push(`First Contentful Paint ${metrics.firstContentfulPaint}ms exceeds threshold ${thresholds.firstContentfulPaint}ms`)
  }

  if (metrics.largestContentfulPaint && metrics.largestContentfulPaint > thresholds.largestContentfulPaint) {
    failures.push(`Largest Contentful Paint ${metrics.largestContentfulPaint}ms exceeds threshold ${thresholds.largestContentfulPaint}ms`)
  }

  // Check API response times
  Object.entries(metrics.apiResponseTimes).forEach(([endpoint, time]) => {
    if (time > thresholds.apiResponse) {
      failures.push(`API ${endpoint} response time ${time}ms exceeds threshold ${thresholds.apiResponse}ms`)
    }
  })

  return {
    passed: failures.length === 0,
    failures,
    metrics
  }
}

/**
 * Generate performance report (pure function - no Cypress commands)
 */
export function generatePerformanceReport (metrics: PerformanceMetrics) {
  const report = {
    timestamp: new Date().toISOString(),
    pagePerformance: {
      pageLoadTime: metrics.pageLoadTime,
      domContentLoadedTime: metrics.domContentLoadedTime,
      firstContentfulPaint: metrics.firstContentfulPaint,
      largestContentfulPaint: metrics.largestContentfulPaint
    },
    apiPerformance: metrics.apiResponseTimes,
    resourcePerformance: metrics.resourceLoadTimes,
    summary: {
      totalApiCalls: Object.keys(metrics.apiResponseTimes).length,
      slowApiCalls: Object.entries(metrics.apiResponseTimes).filter(([, time]) => time > 2000).length,
      averageApiTime: Object.values(metrics.apiResponseTimes).reduce((a, b) => a + b, 0) / Object.keys(metrics.apiResponseTimes).length || 0
    }
  }

  return report
}

// Cypress commands for performance testing
Cypress.Commands.add('measurePagePerformance', (thresholds?: PerformanceThresholds) => {
  return trackPagePerformance().then((metrics: PerformanceMetrics) => {
    const validation = validatePerformance(metrics, thresholds)
    const report = generatePerformanceReport(metrics)

    // Log performance summary using cy.then to ensure proper chaining
    return cy.task('log', `Performance Report: Page Load ${metrics.pageLoadTime}ms, APIs: ${report.summary.totalApiCalls} (avg ${Math.round(report.summary.averageApiTime)}ms)`).then(() => {
      if (!validation.passed) {
        return cy.task('log', `Performance issues detected: ${validation.failures.join(', ')}`).then(() => {
          // In CI, we might want this to fail the test
          if (Cypress.env('FAIL_ON_PERFORMANCE_ISSUES')) {
            throw new Error(`Performance thresholds exceeded: ${validation.failures.join(', ')}`)
          }
          return { validation, report, metrics }
        })
      }
      return { validation, report, metrics }
    })
  })
})

Cypress.Commands.add('startPerformanceMonitoring', () => {
  monitorApiPerformance()

  // Track when monitoring started
  cy.wrap(Date.now()).as('performanceMonitoringStart')
  cy.wrap({}).as('apiResponseTimes')
})

Cypress.Commands.add('stopPerformanceMonitoring', () => {
  return cy.get('@apiResponseTimes').then(apiTimes => {
    return cy.get('@performanceMonitoringStart').then(startTime => {
      const duration = Date.now() - (startTime as number)

      const metrics: PerformanceMetrics = {
        pageLoadTime: 0, // Will be measured separately
        domContentLoadedTime: 0,
        apiResponseTimes: apiTimes as Record<string, number>,
        resourceLoadTimes: {}
      }

      const report = generatePerformanceReport(metrics)

      return {
        duration,
        metrics,
        report
      }
    })
  })
})

// Type definitions for custom commands
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      /**
       * Measure page performance and validate against thresholds
       * @example
       * cy.visit('/events')
       * cy.measurePagePerformance()
       */
      measurePagePerformance(thresholds?: PerformanceThresholds): Chainable<{
        validation: { passed: boolean; failures: string[]; metrics: PerformanceMetrics }
        report: Record<string, unknown>
        metrics: PerformanceMetrics
      }>

      /**
       * Start monitoring API performance
       * @example cy.startPerformanceMonitoring()
       */
      startPerformanceMonitoring(): Chainable<void>

      /**
       * Stop monitoring and get performance report
       * @example cy.stopPerformanceMonitoring()
       */
      stopPerformanceMonitoring(): Chainable<{
        duration: number
        metrics: PerformanceMetrics
        report: Record<string, unknown>
      }>
    }
  }
}
