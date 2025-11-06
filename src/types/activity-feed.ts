import { UserEntity } from './user'

export interface ActivityFeedEntity {
  id: number
  ulid: string
  createdAt: Date
  updatedAt: Date
  activityType: string
  feedScope: 'sitewide' | 'group' | 'event'
  groupId?: number
  eventId?: number
  actorId?: number
  actor?: UserEntity
  actorIds: number[]
  visibility: 'public' | 'authenticated' | 'members_only' | 'private'
  aggregatedCount: number
  /**
   * Display name resolved by backend at query time.
   * - For ATProto shadow users: resolved handle (e.g., alice.bsky.social)
   * - For regular users: firstName + lastName
   * - Always fresh (uses 15min cache for optimal performance)
   */
  displayName?: string
  metadata: {
    groupSlug?: string
    groupName?: string
    eventSlug?: string
    eventName?: string
    actorSlug?: string
    /**
     * @deprecated Use displayName field instead (resolved by backend).
     * This field may contain stale data or DIDs for older entries.
     */
    actorName?: string
    [key: string]: unknown
  }
}
