import { computed, type ComputedRef } from 'vue'
import type { ActivityFeedEntity } from '../types'

/**
 * Composable for consistent display name resolution across activity feeds.
 *
 * The backend resolves display names at query time:
 * - ATProto shadow users: Returns resolved handle (e.g., alice.bsky.social)
 * - Regular users: Returns firstName + lastName
 * - Uses 15-minute cache for optimal performance
 *
 * Usage:
 * - Always use getDisplayName() for activity feed actor names
 * - Falls back to metadata.actorName for backwards compatibility
 * - Returns "Someone" if no name is available (graceful degradation)
 *
 * @example
 * ```vue
 * <script setup>
 * import { useDisplayName } from '@/composables/useDisplayName'
 *
 * const { getDisplayName } = useDisplayName()
 * const displayName = getDisplayName(activity)
 * </script>
 * ```
 */
export function useDisplayName () {
  /**
   * Get display name for an activity feed entity.
   *
   * Priority order:
   * 1. activity.displayName (backend-resolved, always fresh)
   * 2. activity.metadata.actorName (legacy fallback)
   * 3. "Someone" (graceful degradation)
   *
   * @param activity - Activity feed entity from API
   * @returns Resolved display name (handle or name)
   */
  function getDisplayName (activity: ActivityFeedEntity & { displayName?: string }): string {
    // Prefer backend-resolved displayName
    if (activity.displayName) {
      return activity.displayName
    }

    // Fallback to metadata.actorName for backwards compatibility
    if (activity.metadata?.actorName) {
      return activity.metadata.actorName
    }

    // Graceful degradation
    return 'Someone'
  }

  /**
   * Get reactive computed display name.
   *
   * Useful when you need a reactive reference to the display name.
   *
   * @param activity - Activity feed entity from API
   * @returns Computed ref with display name
   */
  function getDisplayNameComputed (
    activity: ComputedRef<ActivityFeedEntity & { displayName?: string }>
  ): ComputedRef<string> {
    return computed(() => getDisplayName(activity.value))
  }

  /**
   * Check if a display name looks like a DID.
   *
   * DIDs should not appear in display names as they are resolved by the backend.
   * This function is useful for debugging or backwards compatibility checks.
   *
   * @param displayName - The display name to check
   * @returns True if the name is a DID format (did:plc:...)
   */
  function isDidFormat (displayName: string): boolean {
    return displayName.startsWith('did:')
  }

  return {
    getDisplayName,
    getDisplayNameComputed,
    isDidFormat
  }
}
