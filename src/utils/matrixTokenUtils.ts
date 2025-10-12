/**
 * Simple, synchronous Matrix token utilities
 * No complex async logic, no race conditions - just direct localStorage checks
 */

export interface StoredTokenData {
  accessToken?: string
  refreshToken?: string
  userId?: string
  expiry?: string | Date
  [key: string]: unknown
}

/**
 * Check if user has any Matrix tokens stored (access or refresh)
 * This is a simple, synchronous check that doesn't validate token expiry
 * or make server calls - just checks if tokens exist locally
 *
 * Uses new per-device format: matrix_session_{userSlug}_{deviceId}
 * Also checks legacy format for backward compatibility during migration
 */
export function hasStoredMatrixTokens (userSlug: string): boolean {
  if (!userSlug) return false

  // Check new per-device format: matrix_session_{userSlug}_{deviceId}
  // Scan localStorage for any keys matching this pattern
  const deviceKeyPrefix = `matrix_session_${userSlug}_`

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith(deviceKeyPrefix)) {
      try {
        const storedData = localStorage.getItem(key)
        if (storedData) {
          const tokenData: StoredTokenData = JSON.parse(storedData)
          if (tokenData.accessToken || tokenData.refreshToken) {
            return true
          }
        }
      } catch {
        // Continue checking other keys
      }
    }
  }

  // Fallback: Check legacy per-user format (deprecated, for migration)
  const legacyKey = `matrix_session_${userSlug}`
  const legacyData = localStorage.getItem(legacyKey)

  if (legacyData) {
    try {
      const tokenData: StoredTokenData = JSON.parse(legacyData)
      return !!(tokenData.accessToken || tokenData.refreshToken)
    } catch {
      return false
    }
  }

  return false
}

/**
 * Get stored Matrix tokens for a user (if they exist)
 * Returns null if no tokens found or parsing fails
 *
 * Uses new per-device format: matrix_session_{userSlug}_{deviceId}
 * Also checks legacy format for backward compatibility during migration
 */
export function getStoredMatrixTokens (userSlug: string): StoredTokenData | null {
  if (!userSlug) return null

  // Check new per-device format: matrix_session_{userSlug}_{deviceId}
  // Return first valid token set found
  const deviceKeyPrefix = `matrix_session_${userSlug}_`

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith(deviceKeyPrefix)) {
      try {
        const storedData = localStorage.getItem(key)
        if (storedData) {
          const tokenData = JSON.parse(storedData) as StoredTokenData
          if (tokenData.accessToken || tokenData.refreshToken) {
            return tokenData
          }
        }
      } catch {
        // Continue checking other keys
      }
    }
  }

  // Fallback: Check legacy per-user format (deprecated, for migration)
  const legacyKey = `matrix_session_${userSlug}`
  const legacyData = localStorage.getItem(legacyKey)

  if (legacyData) {
    try {
      return JSON.parse(legacyData) as StoredTokenData
    } catch {
      return null
    }
  }

  return null
}
