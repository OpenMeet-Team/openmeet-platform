import { OidcTokenRefresher, type AccessTokens } from 'matrix-js-sdk'
import { type IdTokenClaims } from 'oidc-client-ts'

/**
 * OpenMeet Matrix OidcTokenRefresher that implements token persistence
 * Based on Element Web's approach for handling Matrix OIDC token refresh
 */
export class TokenRefresher extends OidcTokenRefresher {
  private readonly deviceId: string
  private readonly userId: string

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
    console.log('🔄 TokenRefresher.doRefreshAccessToken() called - starting token refresh', {
      hasRefreshToken: !!refreshToken,
      refreshTokenLength: refreshToken?.length || 0
    })

    try {
      // Call the parent class method which handles the actual OIDC token refresh
      const tokens = await super.doRefreshAccessToken(refreshToken)

      console.log('✅ TokenRefresher.doRefreshAccessToken() successful:', {
        hasAccessToken: !!tokens.accessToken,
        hasRefreshToken: !!tokens.refreshToken,
        accessTokenLength: tokens.accessToken?.length || 0
      })

      return tokens
    } catch (error) {
      console.error('❌ TokenRefresher.doRefreshAccessToken() failed:', error)
      throw error
    }
  }

  /**
   * Persist tokens to localStorage (similar to Element Web's approach)
   */
  public async persistTokens ({ accessToken, refreshToken }: AccessTokens): Promise<void> {
    try {
      console.log('🔑 Persisting refreshed OIDC tokens to storage')

      // Store tokens in localStorage with user/device specific keys
      const accessTokenKey = `matrix_access_token_${this.userId}_${this.deviceId}`
      const refreshTokenKey = `matrix_refresh_token_${this.userId}_${this.deviceId}`

      localStorage.setItem(accessTokenKey, accessToken)
      if (refreshToken) {
        localStorage.setItem(refreshTokenKey, refreshToken)
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
          console.log('✅ Updated stored Matrix credentials with refreshed tokens')
        } catch (error) {
          console.warn('⚠️ Failed to update stored credentials:', error)
        }
      }

      console.log('✅ OIDC tokens persisted successfully')
    } catch (error) {
      console.error('❌ Failed to persist OIDC tokens:', error)
      throw error
    }
  }
}
