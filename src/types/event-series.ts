import { FileEntity, Pagination } from './model'
import { EventEntity, RecurrenceRule } from './event'
import { GroupEntity } from './group'
import { UserEntity } from './user'

export interface EventSeriesEntity {
  id: number
  ulid: string
  slug: string
  name: string
  description?: string
  timeZone: string

  // Recurrence fields moved from event to series
  recurrenceRule: RecurrenceRule
  recurrenceExceptions?: string[]
  recurrenceUntil?: string
  recurrenceCount?: number
  recurrenceDescription?: string

  // References
  templateEventSlug?: string
  templateEvent?: EventEntity
  events?: EventEntity[]
  eventsCount?: number

  // Metadata
  image?: FileEntity | string
  groupId?: number
  group?: GroupEntity
  userId?: number
  user?: UserEntity
  requireGroupMembership?: boolean

  // Timestamps
  createdAt: string
  updatedAt: string
}

export interface EventOccurrence {
  date: string
  materialized: boolean
  event?: EventEntity
}

export interface EventSeriesPaginationEntity extends Pagination<EventSeriesEntity> {}
