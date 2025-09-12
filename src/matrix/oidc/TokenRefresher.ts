import { OidcTokenRefresher, type AccessTokens } from 'matrix-js-sdk'
import { type IdTokenClaims } from 'oidc-client-ts'
import { logger } from '../../utils/logger'

/**
 * OpenMeet Matrix OidcTokenRefresher that implements token persistence
 * Based on Element Web's approach for handling Matrix OIDC token refresh
 */
export class TokenRefresher extends OidcTokenRefresher {
  private readonly deviceId: string
  private readonly userId: string
  private refreshTimer?: ReturnType<typeof setTimeout>

  public constructor (
    issuer: string,
    clientId: string,
    redirectUri: string,
    deviceId: string,
    idTokenClaims: IdTokenClaims,
    userId: string
  ) {
    console.log('🔧 Creating TokenRefresher with configuration:', {
      issuer,
      clientId,
      redirectUri,
      deviceId,
      userId,
      hasIdTokenClaims: !!idTokenClaims
    })

    super(issuer, clientId, deviceId, redirectUri, idTokenClaims)
    this.deviceId = deviceId
    this.userId = userId

    console.log('✅ TokenRefresher created successfully')
  }

  /**
   * Override doRefreshAccessToken to add debug logging
   * This method is inherited from OidcTokenRefresher but we add logging to track its usage
   */
  public async doRefreshAccessToken (refreshToken: string): Promise<AccessTokens> {
    logger.debug('🔄 TokenRefresher.doRefreshAccessToken() called - starting token refresh', {
      hasRefreshToken: !!refreshToken,
      refreshTokenLength: refreshToken?.length || 0,
      refreshTokenPreview: refreshToken ? refreshToken.substring(0, 10) + '...' : 'none'
    })

    try {
      // Call the parent class method which handles the actual OIDC token refresh
      const tokens = await super.doRefreshAccessToken(refreshToken)

      logger.debug('✅ TokenRefresher.doRefreshAccessToken() successful:', {
        hasAccessToken: !!tokens.accessToken,
        hasRefreshToken: !!tokens.refreshToken,
        accessTokenLength: tokens.accessToken?.length || 0,
        refreshTokenLength: tokens.refreshToken?.length || 0,
        newRefreshTokenPreview: tokens.refreshToken ? tokens.refreshToken.substring(0, 10) + '...' : 'none'
      })

      // Persist the new tokens immediately
      await this.persistTokens(tokens)

      // Schedule proactive refresh for the next token
      this.scheduleProactiveRefresh(tokens)

      return tokens
    } catch (error) {
      logger.error('❌ TokenRefresher.doRefreshAccessToken() failed:', error)
      throw error
    }
  }

  /**
   * Persist tokens to localStorage (similar to Element Web's approach)
   */
  public async persistTokens ({ accessToken, refreshToken }: AccessTokens): Promise<void> {
    try {
      logger.debug('🔑 Persisting refreshed OIDC tokens to storage')

      // Store tokens using the same keys that MatrixClientManager uses for retrieval
      // Extract user slug from userId to match MatrixClientManager pattern
      const userSlugMatch = this.userId.match(/@(.+?)_[^_]+:/)
      const userSlug = userSlugMatch ? userSlugMatch[1] : this.userId.replace(/[@:]/g, '_')

      const accessTokenKey = `matrix_access_token_${userSlug}`
      const refreshTokenKey = `matrix_refresh_token_${userSlug}`

      // Also store with device-specific keys for backward compatibility
      const deviceAccessTokenKey = `matrix_access_token_${this.userId}_${this.deviceId}`
      const deviceRefreshTokenKey = `matrix_refresh_token_${this.userId}_${this.deviceId}`

      // Store both ways to ensure compatibility
      localStorage.setItem(accessTokenKey, accessToken)
      localStorage.setItem(deviceAccessTokenKey, accessToken)

      if (refreshToken) {
        localStorage.setItem(refreshTokenKey, refreshToken)
        localStorage.setItem(deviceRefreshTokenKey, refreshToken)
        logger.debug('🔄 Updated refresh token in storage:', {
          userSlug,
          refreshTokenLength: refreshToken.length,
          refreshTokenKey
        })
      }

      // Also update the main credentials storage
      const storedCredentials = localStorage.getItem('matrix_credentials')
      if (storedCredentials) {
        try {
          const credentials = JSON.parse(storedCredentials)
          credentials.accessToken = accessToken
          if (refreshToken) {
            credentials.refreshToken = refreshToken
          }
          credentials.lastRefresh = Date.now()
          localStorage.setItem('matrix_credentials', JSON.stringify(credentials))
          logger.debug('✅ Updated stored Matrix credentials with refreshed tokens')
        } catch (error) {
          logger.warn('⚠️ Failed to update stored credentials:', error)
        }
      }

      logger.debug('✅ OIDC tokens persisted successfully')
    } catch (error) {
      logger.error('❌ Failed to persist OIDC tokens:', error)
      throw error
    }
  }

  /**
   * Schedule proactive token refresh before expiration
   * For 2-minute tokens, refresh after 60 seconds (50% of lifetime)
   */
  private scheduleProactiveRefresh (tokens: AccessTokens): void {
    // Clear any existing timer
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer)
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
      tokenLifetime: Math.round(tokenLifetime / 1000) + 's',
      refreshDelay: Math.round(refreshDelay / 1000) + 's',
      refreshAt: new Date(now + refreshDelay).toISOString()
    })

    this.refreshTimer = setTimeout(async () => {
      try {
        logger.debug('🔄 Proactive token refresh triggered')

        // Use the same key logic as persistTokens() to find the refresh token
        const userSlugMatch = this.userId.match(/@(.+?)_[^_]+:/)
        const userSlug = userSlugMatch ? userSlugMatch[1] : this.userId.replace(/[@:]/g, '_')
        const refreshTokenKey = `matrix_refresh_token_${userSlug}`

        const currentRefreshToken = localStorage.getItem(refreshTokenKey)
        if (currentRefreshToken) {
          logger.debug('🔄 Found refresh token for proactive refresh:', { refreshTokenKey, tokenLength: currentRefreshToken.length })
          await this.doRefreshAccessToken(currentRefreshToken)
        } else {
          logger.warn('⚠️ No refresh token found for proactive refresh:', { refreshTokenKey, userId: this.userId, userSlug })
        }
      } catch (error) {
        logger.error('❌ Proactive token refresh failed:', error)
      }
    }, refreshDelay)
  }

  /**
   * Clean up any scheduled refresh timers
   */
  public destroy (): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer)
      this.refreshTimer = undefined
    }
  }
}
