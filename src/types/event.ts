import { CategoryEntity, UploadedFileEntity } from 'src/types/model.ts'
import { GroupEntity } from 'src/types/group.ts'

export type EventType = 'online' | 'in-person' | 'hybrid'
export type VisibilityType = 'public' | 'authenticated' | 'private'
interface EventCategory extends CategoryEntity {}
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
  attendees?: never[]
  attendeesCount?: number
  categories?: EventCategory[] | number[]
  groupId?: number
  group?: GroupEntity
  is_public?: boolean
  visibility?: VisibilityType
  userId?: number
}
