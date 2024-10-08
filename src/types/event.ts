import { Category, UploadedFile } from 'src/types/model.ts'
import { GroupEntity } from 'src/types/group.ts'

export type EventType = 'online' | 'in-person' | 'hybrid';
interface EventCategory extends Category {}
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
  image?: string | UploadedFile
  description?: string
  maxAttendees?: number
  attendees?: never[]
  attendeesCount?: number
  categories?: EventCategory[] | number[]
  groupId?: number
  group?: GroupEntity
  is_public?: boolean
  userId?: number
}
