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
   */
  private getStorageKey (userId: string): string {
    const userSlug = this.extractUserSlug(userId)
    return `matrix_session_${userSlug}`
  }

  /**
   * Extract user slug from Matrix user ID
   */
  private extractUserSlug (userId: string): string {
    // Extract user slug from Matrix ID format: @username_slug_devicehash:domain
    const userSlugMatch = userId.match(/@(.+?)_[^_]+:/)
    return userSlugMatch ? userSlugMatch[1] : userId.replace(/[@:]/g, '_')
  }

  /**
   * Get stored tokens for a user
   */
  async getTokens (userId: string): Promise<TokenData | null> {
    try {
      const storageKey = this.getStorageKey(userId)
      const storedData = localStorage.getItem(storageKey)

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
   */
  async setTokens (userId: string, tokens: AccessTokens, additionalData?: Partial<TokenData>): Promise<void> {
    try {
      const storageKey = this.getStorageKey(userId)

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
      const existingData = await this.getTokens(userId) || {}

      const tokenData: TokenData = {
        ...existingData,
        // Add non-token data from additionalData (excluding tokens)
        ...(additionalData && Object.fromEntries(
          Object.entries(additionalData).filter(([key]) =>
            !['accessToken', 'refreshToken', 'expiry'].includes(key)
          )
        )),
        userId,
        lastRefresh: Date.now(),
        // Only store non-empty tokens (these must come LAST to avoid being overwritten)
        ...(tokens.accessToken && tokens.accessToken.trim() !== '' && { accessToken: tokens.accessToken }),
        ...(tokens.refreshToken && tokens.refreshToken.trim() !== '' && { refreshToken: tokens.refreshToken }),
        ...(tokens.expiry && { expiry: tokens.expiry })
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

      // Legacy cleanup removed - clean storage approach

      // Schedule proactive refresh if we have refresh token
      if (tokens.refreshToken && tokens.expiry) {
        this.scheduleProactiveRefresh(userId, tokens)
      }
    } catch (error) {
      logger.error('❌ Failed to store tokens:', error)
      throw error
    }
  }

  // === REFRESH OPERATIONS ===

  /**
   * Refresh tokens for a user (with mutex to prevent concurrent refreshes)
   */
  async refreshTokens (userId: string): Promise<AccessTokens> {
    // Check if refresh is already in progress for this user
    const existingRefresh = this.refreshMutexes.get(userId)
    if (existingRefresh) {
      logger.debug('🔄 Refresh already in progress for user, waiting...', userId)
      return await existingRefresh
    }

    // Start new refresh with mutex
    const refreshPromise = this.doRefreshTokens(userId)
    this.refreshMutexes.set(userId, refreshPromise)

    try {
      const result = await refreshPromise
      return result
    } finally {
      // Always clean up mutex
      this.refreshMutexes.delete(userId)
    }
  }

  /**
   * Internal method to perform the actual token refresh
   */
  private async doRefreshTokens (userId: string): Promise<AccessTokens> {
    logger.debug('🔄 Starting token refresh for user:', userId)

    try {
      // Get current token data
      const tokenData = await this.getTokens(userId)
      if (!tokenData?.refreshToken) {
        throw new Error('No refresh token available for user: ' + userId)
      }

      // Perform OIDC refresh
      const newTokens = await this.performOidcRefresh(tokenData.refreshToken, tokenData)

      // Store new tokens immediately
      await this.setTokens(userId, newTokens, {
        deviceId: tokenData.deviceId,
        oidcIssuer: tokenData.oidcIssuer,
        oidcClientId: tokenData.oidcClientId,
        oidcRedirectUri: tokenData.oidcRedirectUri,
        idTokenClaims: tokenData.idTokenClaims
      })

      logger.debug('✅ Token refresh completed successfully for user:', userId)
      return newTokens
    } catch (error) {
      logger.error('❌ Token refresh failed for user:', userId, error)
      throw error
    }
  }

  /**
   * Perform OIDC token refresh using the refresh token
   */
  private async performOidcRefresh (refreshToken: string, tokenData: TokenData): Promise<AccessTokens> {
    if (!tokenData.oidcIssuer || !tokenData.oidcClientId || !tokenData.oidcRedirectUri) {
      throw new Error('Missing OIDC configuration for token refresh')
    }

    logger.debug('🔄 Performing OIDC token refresh:', {
      issuer: tokenData.oidcIssuer,
      clientId: tokenData.oidcClientId,
      refreshTokenPreview: refreshToken.substring(0, 10) + '...'
    })

    // Safely construct token endpoint URL to avoid double slashes
    const baseUrl = tokenData.oidcIssuer?.endsWith('/')
      ? tokenData.oidcIssuer.slice(0, -1)
      : tokenData.oidcIssuer
    const tokenEndpoint = `${baseUrl}/oauth2/token`

    const requestBody = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: tokenData.oidcClientId,
      redirect_uri: tokenData.oidcRedirectUri
    })

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: requestBody
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger.error('❌ OIDC token refresh failed:', {
        status: response.status,
        statusText: response.statusText,
        errorText
      })

      // Parse error for better error messages
      try {
        const errorData = JSON.parse(errorText)
        if (errorData.error === 'invalid_grant') {
          throw new Error('The provided access grant is invalid, expired, or revoked.')
        }
        throw new Error(`Token refresh failed: ${errorData.error_description || errorData.error}`)
      } catch (parseError) {
        throw new Error(`Token refresh failed with status ${response.status}: ${response.statusText}`)
      }
    }

    const tokenResponse = await response.json()

    // Calculate expiry date
    const expiry = tokenResponse.expires_in
      ? new Date(Date.now() + (tokenResponse.expires_in * 1000))
      : undefined

    const newTokens: AccessTokens = {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      expiry
    }

    logger.debug('✅ OIDC token refresh successful:', {
      hasAccessToken: !!newTokens.accessToken,
      hasRefreshToken: !!newTokens.refreshToken,
      expiry: expiry?.toISOString()
    })

    return newTokens
  }

  /**
   * Schedule proactive token refresh before expiration
   */
  private scheduleProactiveRefresh (userId: string, tokens: AccessTokens): void {
    // Clear any existing timer for this user
    const existingTimer = this.refreshTimers.get(userId)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    if (!tokens.expiry || !tokens.refreshToken) {
      logger.debug('🔄 Cannot schedule proactive refresh - no expiry or refresh token')
      return
    }

    const now = Date.now()
    const expiryTime = tokens.expiry.getTime()
    const tokenLifetime = expiryTime - now

    // For short-lived tokens (< 5 minutes), refresh at 50% of lifetime
    // For longer tokens, refresh 60 seconds before expiry
    const refreshDelay = tokenLifetime < 5 * 60 * 1000
      ? Math.max(tokenLifetime * 0.5, 10 * 1000) // At least 10 seconds
      : Math.max(tokenLifetime - 60 * 1000, 10 * 1000)

    logger.debug('🕐 Scheduling proactive token refresh:', {
      userId,
      tokenLifetime: Math.round(tokenLifetime / 1000) + 's',
      refreshDelay: Math.round(refreshDelay / 1000) + 's',
      refreshAt: new Date(now + refreshDelay).toISOString()
    })

    const timer = setTimeout(async () => {
      try {
        logger.debug('🔄 Proactive token refresh triggered for user:', userId)
        await this.refreshTokens(userId)
      } catch (error) {
        logger.error('❌ Proactive token refresh failed for user:', userId, error)
      } finally {
        this.refreshTimers.delete(userId)
      }
    }, refreshDelay)

    this.refreshTimers.set(userId, timer)
  }

  // === MATRIX SDK INTEGRATION ===

  /**
   * Get a token refresh function for the Matrix SDK
   */
  getTokenRefreshFunction (userId: string): (refreshToken: string) => Promise<AccessTokens> {
    return async (refreshToken: string): Promise<AccessTokens> => {
      logger.debug('🔄 Matrix SDK requested token refresh for user:', userId, {
        sdkProvidedToken: refreshToken.substring(0, 10) + '...'
      })

      try {
        // Use our centralized refresh logic (ignores SDK-provided token in favor of current stored token)
        const newTokens = await this.refreshTokens(userId)

        logger.debug('✅ Matrix SDK token refresh completed for user:', userId)
        return newTokens
      } catch (error) {
        logger.error('❌ Matrix SDK token refresh failed for user:', userId, error)
        throw error
      }
    }
  }

  /**
   * Initialize OIDC configuration for a user
   */
  async initializeOidcConfig (userId: string, config: OidcConfig): Promise<void> {
    const tokenData = await this.getTokens(userId)
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
      })
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
