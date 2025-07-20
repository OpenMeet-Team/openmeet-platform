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

/**
 * Generate a Matrix room alias for an event
 * @param eventSlug The event slug
 * @param tenantId The tenant ID
 * @returns The Matrix room alias (e.g., #event-my-event-tenant123:matrix.openmeet.net)
 */
export const generateEventRoomAlias = (eventSlug: string, tenantId: string): string => {
  const serverName = 'matrix.openmeet.net' // This should match your Matrix server configuration
  return `#event-${eventSlug}-${tenantId}:${serverName}`
}

/**
 * Generate a Matrix room alias for a group
 * @param groupSlug The group slug
 * @param tenantId The tenant ID
 * @returns The Matrix room alias (e.g., #group-my-group-tenant123:matrix.openmeet.net)
 */
export const generateGroupRoomAlias = (groupSlug: string, tenantId: string): string => {
  const serverName = 'matrix.openmeet.net' // This should match your Matrix server configuration
  return `#group-${groupSlug}-${tenantId}:${serverName}`
}
