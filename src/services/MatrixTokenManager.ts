import { type AccessTokens } from 'matrix-js-sdk'
import { type IdTokenClaims } from 'oidc-client-ts'
import { logger } from '../utils/logger'

export interface TokenData {
  accessToken?: string
  refreshToken?: string
  expiry?: Date
  deviceId?: string
  userId: string
  oidcIssuer?: string
  oidcClientId?: string
  oidcRedirectUri?: string
  idTokenClaims?: IdTokenClaims
  lastRefresh?: number
}

interface OidcConfig {
  issuer: string
  clientId: string
  redirectUri: string
  idTokenClaims: IdTokenClaims
}

/**
 * Unified Matrix Token Manager
 * Handles all Matrix token storage, refresh, and lifecycle management
 * Replaces the separate TokenRefresher and scattered storage logic
 */
class MatrixTokenManager {
  private refreshMutexes: Map<string, Promise<AccessTokens>> = new Map()
  private refreshTimers: Map<string, ReturnType<typeof setTimeout>> = new Map()

  constructor () {
    logger.debug('🏗️ MatrixTokenManager instance created')
  }

  // === STORAGE OPERATIONS ===

  /**
   * Get the canonical storage key for a user's tokens
   * With per-device support to prevent multi-tab token conflicts
   */
  private getStorageKey (userId: string, deviceId?: string): string {
    const userSlug = this.extractUserSlug(userId)
    if (deviceId) {
      return `matrix_session_${userSlug}_${deviceId}`
    }
    // Fallback to legacy per-user key for backward compatibility
    return `matrix_session_${userSlug}`
  }

  /**
   * Extract user slug from Matrix user ID
   */
  private extractUserSlug (userId: string): string {
    // Extract user slug from Matrix ID format: @username_tenantid:domain
    const userSlugMatch = userId.match(/@(.+?)_[^_]+:/)
    const result = userSlugMatch ? userSlugMatch[1] : userId.replace(/[@:]/g, '_')

    logger.debug('🔍 CRITICAL DEBUG - User slug extraction:', {
      userId,
      regex: '/@(.+?)_[^_]+:/',
      userSlugMatch,
      extractedSlug: result
    })

    return result
  }

  /**
   * Get stored tokens for a user (and optionally specific device)
   * @param deviceId - Optional device ID for per-device token storage
   */
  async getTokens (userId: string, deviceId?: string): Promise<TokenData | null> {
    try {
      const storageKey = this.getStorageKey(userId, deviceId)
      let storedData = localStorage.getItem(storageKey)

      // MIGRATION: If deviceId provided but no per-device tokens found, try legacy per-user tokens
      if (!storedData && deviceId) {
        const legacyKey = this.getStorageKey(userId) // Without deviceId
        const legacyData = localStorage.getItem(legacyKey)

        if (legacyData) {
          logger.debug('🔄 MIGRATION: Found legacy per-user tokens, migrating to per-device storage:', {
            legacyKey,
            newKey: storageKey,
            deviceId
          })

          // Copy legacy tokens to new per-device storage
          storedData = legacyData
          localStorage.setItem(storageKey, legacyData)

          // Don't delete legacy key yet - other tabs might still need it
          // It will naturally be cleaned up when all tabs upgrade
          logger.debug('✅ MIGRATION: Legacy tokens copied to per-device storage (legacy preserved)')
        }
      }

      // CRITICAL DEBUG: Check what's actually in localStorage
      logger.debug('🔍 CRITICAL DEBUG - Raw localStorage check:', {
        storageKey,
        hasData: !!storedData,
        dataLength: storedData?.length || 0,
        dataPreview: storedData ? storedData.substring(0, 150) + '...' : 'NULL'
      })

      if (!storedData) {
        logger.debug('🔍 No tokens found in storage for user:', userId, 'storageKey:', storageKey)
        return null
      }

      const tokenData: TokenData = JSON.parse(storedData)

      // Convert expiry back to Date object if it exists
      if (tokenData.expiry && typeof tokenData.expiry === 'string') {
        tokenData.expiry = new Date(tokenData.expiry)
      }

      logger.debug('✅ Retrieved tokens from storage:', {
        userId,
        storageKey,
        hasAccessToken: !!tokenData.accessToken,
        hasRefreshToken: !!tokenData.refreshToken,
        hasExpiry: !!tokenData.expiry,
        isExpired: tokenData.expiry ? tokenData.expiry < new Date() : false,
        deviceId: tokenData.deviceId,
        lastRefresh: tokenData.lastRefresh
      })

      return tokenData
    } catch (error) {
      logger.error('❌ Failed to retrieve tokens from storage:', error)
      return null
    }
  }

  /**
   * Store tokens for a user (single source of truth)
   * @param deviceId - Optional device ID for per-device token storage
   */
  async setTokens (userId: string, tokens: AccessTokens, additionalData?: Partial<TokenData>, deviceId?: string): Promise<void> {
    try {
      const storageKey = this.getStorageKey(userId, deviceId)

      // Warn if we're being called with empty tokens (this shouldn't happen)
      if (!tokens.accessToken && !tokens.refreshToken) {
        logger.warn('⚠️ setTokens() called with no valid tokens - this may clear stored tokens:', {
          userId,
          storageKey,
          callStack: new Error().stack?.split('\n').slice(1, 4).join('\n')
        })
      }

      logger.debug('🔄 Setting tokens for user:', {
        userId,
        storageKey,
        hasAccessToken: !!tokens.accessToken,
        hasRefreshToken: !!tokens.refreshToken,
        accessTokenLength: tokens.accessToken?.length || 0,
        refreshTokenLength: tokens.refreshToken?.length || 0,
        additionalData: Object.keys(additionalData || {})
      })

      // Get existing data to preserve non-token information
      const existingData = await this.getTokens(userId, deviceId)

      const tokenData: TokenData = {
        // Start with existing data as base
        ...(existingData || {}),
        // Add non-token data from additionalData (excluding tokens)
        ...(additionalData && Object.fromEntries(
          Object.entries(additionalData).filter(([key]) =>
            !['accessToken', 'refreshToken', 'expiry'].includes(key)
          )
        )),
        // Always set these core fields
        userId,
        lastRefresh: Date.now(),
        // Update tokens: preserve existing tokens if new ones are empty, otherwise use new ones
        accessToken: (tokens.accessToken && tokens.accessToken.trim() !== '')
          ? tokens.accessToken
          : existingData?.accessToken,
        refreshToken: (tokens.refreshToken && tokens.refreshToken.trim() !== '')
          ? tokens.refreshToken
          : existingData?.refreshToken,
        expiry: tokens.expiry || existingData?.expiry
      }

      localStorage.setItem(storageKey, JSON.stringify(tokenData))

      // CRITICAL DEBUG: Verify storage immediately after setItem
      const verifyStored = localStorage.getItem(storageKey)
      logger.debug('🔍 CRITICAL DEBUG - Verifying localStorage immediately after setItem:', {
        storageKey,
        wasStored: !!verifyStored,
        storedLength: verifyStored?.length || 0,
        storedDataPreview: verifyStored ? verifyStored.substring(0, 100) + '...' : 'NULL'
      })

      logger.debug('✅ Tokens stored successfully:', {
        userId,
        storageKey,
        hasAccessToken: !!tokenData.accessToken,
        hasRefreshToken: !!tokenData.refreshToken,
        accessTokenLength: tokenData.accessToken?.length || 0,
        refreshTokenLength: tokenData.refreshToken?.length || 0
      })
    } catch (error) {
      logger.error('❌ Failed to store tokens:', error)
      throw error
    }
  }

  /**
   * Initialize OIDC configuration for a user
   * @param deviceId - Optional device ID for per-device token storage
   */
  async initializeOidcConfig (userId: string, config: OidcConfig, deviceId?: string): Promise<void> {
    const tokenData = await this.getTokens(userId, deviceId)
    // Only update if we have actual tokens to preserve
    if (tokenData?.accessToken && tokenData?.refreshToken) {
      await this.setTokens(userId, {
        accessToken: tokenData.accessToken,
        refreshToken: tokenData.refreshToken,
        expiry: tokenData.expiry
      }, {
        oidcIssuer: config.issuer,
        oidcClientId: config.clientId,
        oidcRedirectUri: config.redirectUri,
        idTokenClaims: config.idTokenClaims
      }, deviceId)
    } else {
      logger.debug('🔧 Skipping OIDC config initialization - no existing tokens to preserve')
    }
  }

  // === CLEANUP ===

  /**
   * Clean up timers for a user (call when user logs out)
   */
  cleanupUser (userId: string): void {
    const timer = this.refreshTimers.get(userId)
    if (timer) {
      clearTimeout(timer)
      this.refreshTimers.delete(userId)
      logger.debug('🧹 Cleaned up refresh timer for user:', userId)
    }

    // Clean up any in-flight refresh
    this.refreshMutexes.delete(userId)
  }

  /**
   * Clean up all resources
   */
  destroy (): void {
    this.refreshTimers.forEach((timer) => {
      clearTimeout(timer)
    })
    this.refreshTimers.clear()
    this.refreshMutexes.clear()
    logger.debug('🧹 MatrixTokenManager destroyed')
  }
}

// Export class and singleton instance
export { MatrixTokenManager }

// Create singleton instance
let matrixTokenManagerInstance: MatrixTokenManager | null = null

export const matrixTokenManager = (() => {
  if (!matrixTokenManagerInstance) {
    matrixTokenManagerInstance = new MatrixTokenManager()
  }
  return matrixTokenManagerInstance
})()
