/**
 * Platform Token Refresher
 *
 * Extends Matrix SDK's OidcTokenRefresher to handle token persistence
 * following Element Web's proven pattern.
 *
 * This approach eliminates manual token refresh implementation and uses
 * the SDK's built-in token refresh mechanisms, which automatically
 * update the Matrix client's internal token state.
 */

import { type AccessTokens } from 'matrix-js-sdk'
import { OidcTokenRefresher } from 'matrix-js-sdk/lib/oidc/tokenRefresher'
import { type IdTokenClaims } from 'oidc-client-ts'
import { matrixTokenManager } from './MatrixTokenManager'
import { logger } from '../utils/logger'

export class PlatformTokenRefresher extends OidcTokenRefresher {
  constructor (
    issuer: string,
    clientId: string,
    redirectUri: string,
    private readonly deviceId: string,
    idTokenClaims: IdTokenClaims,
    private readonly userId: string
  ) {
    super(issuer, clientId, deviceId, redirectUri, idTokenClaims)
  }

  /**
   * Called by Matrix SDK after successful token refresh
   * This method only handles storage persistence - the SDK automatically
   * applies the new tokens to the Matrix client instance
   *
   * IMPORTANT: Must pass deviceId to ensure tokens are stored per-device
   */
  async persistTokens ({ accessToken, refreshToken }: AccessTokens): Promise<void> {
    logger.debug('🔄 SDK token refresh completed, persisting tokens for user:', this.userId, 'device:', this.deviceId)

    try {
      // CRITICAL: Pass deviceId to store tokens per-device (not per-user)
      // This ensures each tab/device has its own token storage
      await matrixTokenManager.setTokens(this.userId, {
        accessToken,
        refreshToken,
        expiry: undefined // SDK handles expiry internally
      }, undefined, this.deviceId)

      logger.debug('✅ Token persistence completed successfully', {
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken,
        userId: this.userId,
        deviceId: this.deviceId
      })
    } catch (error) {
      logger.error('❌ Failed to persist tokens after refresh:', error)
      throw error
    }
  }
}
