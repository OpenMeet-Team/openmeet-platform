import { CategoryEntity, FileEntity, Pagination } from 'src/types/model.ts'
import { GroupEntity, GroupMemberEntity } from 'src/types/group.ts'
import { UserEntity } from 'src/types/user.ts'

export type EventType = 'online' | 'in-person' | 'hybrid'
export type EventVisibilityType = 'public' | 'authenticated' | 'private'
export type EventStatusType = 'draft' | 'pending' | 'published'
export type EventAttendeeRole = 'participant' | 'host' | 'speaker' | 'moderator' | 'guest'
export enum EventAttendeeStatus {
  Invited = 'invited',
  Confirmed = 'confirmed',
  Attended = 'attended',
  Cancelled = 'cancelled',
  Rejected = 'rejected',
}

interface EventCategory extends CategoryEntity {}
export interface EventAttendeeEntity {
  id: number
  user: UserEntity
  role: EventAttendeeRole
  status: EventAttendeeStatus
}
export interface EventEntity {
  id: number
  slug: string
  name: string
  startDate: string
  endDate?: string
  type: EventType
  location?: string
  locationOnline?: string
  lat?: number
  lon?: number
  image?: FileEntity | string
  description?: string
  maxAttendees?: number
  attendees?: EventAttendeeEntity[]
  attendeesCount?: number
  categories?: EventCategory[] | number[]
  groupId?: number
  group?: GroupEntity
  visibility?: EventVisibilityType
  userId?: number
  user?: UserEntity
  status?: EventStatusType,
  groupMember?: GroupMemberEntity
}

export interface EventPaginationEntity extends Pagination<EventEntity> {}
