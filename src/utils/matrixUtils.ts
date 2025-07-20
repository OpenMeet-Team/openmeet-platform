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

/**
 * Interface for parsed Matrix room alias information
 */
export interface RoomAliasInfo {
  type: string
  slug: string
  tenantId: string
  roomAlias: string
}

/**
 * Parse a Matrix room alias to extract type, slug, and tenant ID
 * Format: #type-slug-tenantId:server.com
 * @param roomAlias The full room alias
 * @returns Parsed room alias info or null if invalid format
 */
export const parseRoomAlias = (roomAlias: string): RoomAliasInfo | null => {
  if (!roomAlias) return null

  // Remove # prefix if present
  const alias = roomAlias.startsWith('#') ? roomAlias.substring(1) : roomAlias

  // Split by colon to get localpart
  const [localpart] = alias.split(':')
  if (!localpart) return null

  // Split by hyphen
  const parts = localpart.split('-')
  if (parts.length < 3) return null

  const type = parts[0] // First part is type
  const tenantId = parts[parts.length - 1] // Last part is tenant ID
  const slug = parts.slice(1, -1).join('-') // Everything in between is slug

  if (!type || !slug || !tenantId) return null

  return {
    type,
    slug,
    tenantId,
    roomAlias
  }
}
