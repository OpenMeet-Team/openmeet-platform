/**
 * Console filtering utility to reduce Matrix SDK HTTP API logging verbosity
 * in development while preserving important debugging information
 */

import { logger } from './logger'

interface MatrixLogStats {
  filteredCount: number
  showFiltered: boolean
  toggleFiltering: () => void
  getStats: () => { filteredCount: number; isFiltering: boolean; patterns: number }
  help: () => void
}

// Extend the global Window interface for TypeScript
declare global {
  interface Window {
    __matrixLogStats: MatrixLogStats
  }
}

// Store original console methods
const originalConsole = {
  log: console.log,
  debug: console.debug,
  info: console.info,
  warn: console.warn,
  error: console.error
}

// Patterns to filter out in development
const DEVELOPMENT_FILTERS = [
  /^FetchHttpApi: --> (GET|POST|PUT|DELETE) https:\/\/.*\/_matrix\/client\//,
  /^FetchHttpApi: <-- (GET|POST|PUT|DELETE) https:\/\/.*\/_matrix\/client\//,
  // Filter routine Matrix operations that commonly return 404s (expected behavior)
  /^\[PerSessionKeyBackupDownloader\] Checking key backup for session/,
  /^\[PerSessionKeyBackupDownloader\] No luck requesting key backup for session.*M_NOT_FOUND/,
  // Filter other routine Matrix SDK operations
  /^Backup: Starting keys upload loop/,
  /^Backup: Got current backup version/,
  /^\[PerSessionKeyBackupDownloader\] Got current backup version/,
  // Filter routine sync and connection logs
  /^Sliding sync request took/,
  /^Sliding sync returned after/,
  /^Sliding sync yielded response with/,
  // Filter routine WebRTC and media logs
  /^MediaHandler:/,
  /^Call:/
]

// Patterns that should NEVER be filtered (even if they match above)
const IMPORTANT_PATTERNS = [
  // Critical errors and failures
  /error|Error|ERROR/i,
  /fail|Fail|FAIL/i,
  // HTTP errors that indicate real problems
  /401|403|500|502|503/,
  /unauthorized|forbidden/i,
  // Authentication and security issues
  /auth.*error|Auth.*Error/i,
  /verification.*fail|Verification.*fail/i
]

/**
 * Check if a log message should be filtered
 */
function shouldFilterMessage (message: string): boolean {
  // Special case: Allow filtering of routine key backup 404s even if they contain "404"
  const isRoutineKeyBackup404 = /M_NOT_FOUND.*No room_keys found|key backup.*M_NOT_FOUND|PerSessionKeyBackupDownloader.*No luck/.test(message)

  if (isRoutineKeyBackup404) {
    // Filter these routine key backup messages
    return true
  }

  // Never filter important messages (except routine key backup 404s handled above)
  if (IMPORTANT_PATTERNS.some(pattern => pattern.test(message))) {
    return false
  }

  // Filter development noise
  return DEVELOPMENT_FILTERS.some(pattern => pattern.test(message))
}

/**
 * Create a filtered console method
 */
function createFilteredMethod (originalMethod: (...args: unknown[]) => void) {
  return (...args: unknown[]) => {
    // Convert arguments to string for pattern matching
    const message = args.map(arg => {
      if (typeof arg === 'string') return arg
      if (typeof arg === 'object' && arg !== null) {
        try {
          return JSON.stringify(arg)
        } catch (error) {
          // Handle circular references or other JSON.stringify errors
          return `[${arg.constructor?.name || 'Object'}]`
        }
      }
      return String(arg)
    }).join(' ')

    // Apply filtering only in development
    if (process.env.NODE_ENV === 'development' && shouldFilterMessage(message)) {
      // Optionally count filtered messages
      if (window.__matrixLogStats) {
        window.__matrixLogStats.filteredCount = (window.__matrixLogStats.filteredCount || 0) + 1
      }
      return
    }

    // Call original method
    originalMethod.apply(console, args)
  }
}

/**
 * Apply console filtering for Matrix SDK logs
 */
export function enableConsoleFiltering (): void {
  if (process.env.NODE_ENV !== 'development') {
    logger.debug('Console filtering disabled in production')
    return
  }

  // Override console methods with filtered versions
  console.log = createFilteredMethod(originalConsole.log)
  console.debug = createFilteredMethod(originalConsole.debug)
  console.info = createFilteredMethod(originalConsole.info)
  // Don't filter warnings and errors - they're usually important

  // Add debug utility to window

  const matrixLogStats: MatrixLogStats = {
    filteredCount: 0,
    showFiltered: false,
    toggleFiltering: () => {
      const stats = window.__matrixLogStats
      stats.showFiltered = !stats.showFiltered
      if (stats.showFiltered) {
        disableConsoleFiltering()
        logger.debug('🔍 Matrix log filtering DISABLED - showing all logs')
      } else {
        enableConsoleFiltering()
        logger.debug('🔍 Matrix log filtering ENABLED - hiding HTTP API logs')
      }
    },
    getStats: () => {
      const stats = window.__matrixLogStats
      return {
        filteredCount: stats.filteredCount,
        isFiltering: !stats.showFiltered,
        patterns: DEVELOPMENT_FILTERS.length
      }
    },
    help: () => {
      console.log(`
🔍 Matrix Console Filtering Help:

Commands:
  window.__matrixLogStats.toggleFiltering() - Toggle filtering on/off
  window.__matrixLogStats.getStats()       - Show filtering statistics
  window.__matrixLogStats.help()           - Show this help

Current status: ${window.__matrixLogStats.showFiltered ? 'DISABLED' : 'ENABLED'}
Filtered so far: ${window.__matrixLogStats.filteredCount} logs

What gets filtered:
  • FetchHttpApi HTTP requests/responses
  • Routine key backup checks (including 404s)
  • Matrix sync and connection logs
  • Other routine Matrix SDK operations

What NEVER gets filtered:
  • Real errors and failures
  • Authentication issues  
  • HTTP errors (401, 403, 500, etc.)
  • Security/verification problems
      `)
    }
  }

  // Assign to window
  window.__matrixLogStats = matrixLogStats

  logger.debug('🔍 Matrix console filtering enabled for development')
  logger.debug('🔍 Use window.__matrixLogStats.toggleFiltering() to toggle on/off')
  logger.debug(`🔍 Filtering patterns: ${DEVELOPMENT_FILTERS.length} HTTP API patterns`)
  logger.debug('🔍 Important logs (errors, failures, HTTP errors) will never be filtered')
}

/**
 * Restore original console methods
 */
export function disableConsoleFiltering (): void {
  console.log = originalConsole.log
  console.debug = originalConsole.debug
  console.info = originalConsole.info
  console.warn = originalConsole.warn
  console.error = originalConsole.error

  logger.debug('🔍 Console filtering disabled - all logs restored')
}

/**
 * Initialize console filtering if in development environment
 */
export function initConsoleFiltering (): void {
  if (process.env.NODE_ENV === 'development') {
    // Small delay to ensure logger is ready
    setTimeout(() => {
      enableConsoleFiltering()
    }, 100)
  }
}
