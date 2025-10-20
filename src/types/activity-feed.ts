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
  actorIds: number[]
  visibility: 'public' | 'authenticated' | 'members_only' | 'private'
  aggregatedCount: number
  metadata: {
    groupSlug?: string
    groupName?: string
    eventSlug?: string
    eventName?: string
    actorSlug?: string
    actorName?: string
    [key: string]: unknown
  }
}
