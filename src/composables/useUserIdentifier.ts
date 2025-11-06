import { AuthProvidersEnum } from '../types'

/**
 * Composable for getting the best identifier for user profile links.
 *
 * For Bluesky users, uses their DID which the backend profile endpoint
 * will resolve to their current handle for display. This provides a simple,
 * efficient approach with no extra API calls.
 *
 * Priority order:
 * 1. DID (for Bluesky users) - Backend resolves to handle on profile page
 * 2. Slug (for all other users) - Standard user slug
 *
 * **NOTE**: While this returns different identifier types (DID or slug), we pass it
 * through the route's `slug` parameter for simplicity. This is semantically not quite
 * right, but changing the route param name to `identifier` would require updating the
 * route definition and all references throughout the codebase. The backend profile
 * endpoint accepts any identifier type regardless of the parameter name.
 *
 * @example
 * ```vue
 * <script setup>
 * import { useUserIdentifier } from '@/composables/useUserIdentifier'
 *
 * const { getUserIdentifier } = useUserIdentifier()
 *
 * // Get identifier for router link (passed as 'slug' param even though it may be a DID)
 * const userLink = { name: 'MemberPage', params: { slug: getUserIdentifier(user) } }
 * </script>
 * ```
 */
export function useUserIdentifier () {
  /**
   * Get the best identifier for linking to a user's profile.
   *
   * For Bluesky users, returns their DID which the backend profile endpoint
   * will resolve to their current handle. For all other users, returns slug.
   *
   * @param user - User entity with slug, socialId, and provider
   * @returns Best identifier for the user (DID or slug)
   */
  function getUserIdentifier (user: {
    slug: string
    socialId?: string | null
    provider?: string
  }): string {
    // For Bluesky users, use DID (backend resolves to handle)
    if (user.provider === AuthProvidersEnum.bluesky && user.socialId?.startsWith('did:')) {
      return user.socialId
    }

    // For all other users, use slug
    return user.slug
  }

  return {
    getUserIdentifier
  }
}
