// Removed unused imports since Matrix user provisioning is now handled by MAS

/**
 * DEPRECATED: Matrix user provisioning is no longer needed with MAS (MSC3861)
 * With MAS, users are auto-provisioned during authentication flow.
 * This function now just returns true to maintain compatibility.
 * @returns Always returns true since MAS handles user creation automatically
 */
export const ensureMatrixUser = async (): Promise<boolean> => {
  console.log('🗑️ ensureMatrixUser called but is deprecated - MAS handles user provisioning automatically')
  // With MAS (MSC3861), users are auto-provisioned during authentication
  // No manual provisioning needed
  return true
}

/**
 * Extracts a display name from a Matrix user ID
 * @param matrixUserId The Matrix user ID (e.g., @username:domain.com)
 * @returns The extracted username or the original ID if extraction fails
 */
export const getMatrixDisplayName = (matrixUserId: string): string => {
  if (!matrixUserId) return 'Unknown User'

  const match = matrixUserId.match(/@([^:]+)/)
  return match ? match[1] : matrixUserId
}
