import { CategoryEntity, FileEntity, Pagination } from 'src/types/model.ts'
import { GroupEntity, GroupMemberEntity } from 'src/types/group.ts'
import { UserEntity } from 'src/types/user.ts'

export type EventType = 'online' | 'in-person' | 'hybrid'
export type EventVisibilityType = 'public' | 'authenticated' | 'private'
export type EventStatusType = 'draft' | 'pending' | 'published'
export type EventAttendeeRole = 'participant' | 'host' | 'speaker' | 'moderator' | 'guest'
export type EventAttendeeStatus = 'invited' | 'confirmed' | 'attended' | 'cancelled' | 'rejected';

interface EventCategory extends CategoryEntity {}
export interface EventAttendeeEntity {
  id: number
  user: UserEntity
  rsvpStatus: string
  isHost: boolean
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
  attendee?: EventAttendeeEntity
}

export interface EventPaginationEntity extends Pagination<EventEntity> {}
