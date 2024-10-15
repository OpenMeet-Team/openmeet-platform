import { CategoryEntity, Pagination, UploadedFileEntity } from 'src/types/model.ts'
import { GroupEntity } from 'src/types/group.ts'

export type EventType = 'online' | 'in-person' | 'hybrid'
export type EventVisibilityType = 'public' | 'authenticated' | 'private'
export type EventStatusType = 'draft' | 'pending' | 'published'

interface EventCategory extends CategoryEntity {}
export interface EventAttendeeEntity {

}
export interface EventEntity {
  id: number
  name: string
  startDate: string
  endDate?: string
  type: EventType
  location?: string
  locationOnline?: string
  lat?: number
  lon?: number
  image?: string | UploadedFileEntity
  description?: string
  maxAttendees?: number
  attendees?: EventAttendeeEntity[]
  attendeesCount?: number
  categories?: EventCategory[] | number[]
  groupId?: number
  group?: GroupEntity
  visibility?: EventVisibilityType
  userId?: number
  status?: EventStatusType
}

export interface EventPaginationEntity extends Pagination<EventEntity> {}
