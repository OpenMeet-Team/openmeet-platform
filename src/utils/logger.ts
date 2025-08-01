/**
 * Conditional logging utility for development debugging
 * Only logs in development/debug environments to prevent production noise
 */

import getEnv from './env'

class ConditionalLogger {
  private isDevelopment: boolean

  constructor() {
    // Check if we're in development mode
    const nodeEnv = getEnv('NODE_ENV')
    const debugMode = getEnv('DEBUG')
    this.isDevelopment = nodeEnv === 'development' || debugMode === 'true' || process.env.NODE_ENV === 'development'
  }

  /**
   * Debug level logging - only shows in development
   */
  debug(...args: unknown[]): void {
    if (this.isDevelopment) {
      console.log(...args)
    }
  }

  /**
   * Info level logging - shows in development and staging
   */
  info(...args: unknown[]): void {
    if (this.isDevelopment) {
      console.info(...args)
    }
  }

  /**
   * Warning level logging - always shows (important for debugging issues)
   */
  warn(...args: unknown[]): void {
    console.warn(...args)
  }

  /**
   * Error level logging - always shows (critical for debugging)
   */
  error(...args: unknown[]): void {
    console.error(...args)
  }

  /**
   * Check if development logging is enabled
   */
  isDev(): boolean {
    return this.isDevelopment
  }
}

// Export singleton instance
export const logger = new ConditionalLogger()
export default logger