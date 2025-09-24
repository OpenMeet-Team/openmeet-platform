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
 */
export function hasStoredMatrixTokens (userSlug: string): boolean {
  if (!userSlug) return false

  const storageKey = `matrix_session_${userSlug}`
  const storedData = localStorage.getItem(storageKey)

  if (!storedData) return false

  try {
    const tokenData: StoredTokenData = JSON.parse(storedData)
    // We have tokens if either access or refresh token exists
    return !!(tokenData.accessToken || tokenData.refreshToken)
  } catch {
    return false
  }
}

/**
 * Get stored Matrix tokens for a user (if they exist)
 * Returns null if no tokens found or parsing fails
 */
export function getStoredMatrixTokens (userSlug: string): StoredTokenData | null {
  if (!userSlug) return null

  const storageKey = `matrix_session_${userSlug}`
  const storedData = localStorage.getItem(storageKey)

  if (!storedData) return null

  try {
    return JSON.parse(storedData) as StoredTokenData
  } catch {
    return null
  }
}
