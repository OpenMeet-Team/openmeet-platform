import { UploadedFile } from 'src/types/model.ts'

export type EventType = 'online' | 'in-person' | 'hybrid';

export interface EventData {
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
  categories?: string[]
  groupId?: string
  is_public?: boolean
  userId?: string
}

// export interface Event {
//   name: string;
//   image: string;
//   description: string;
//   startDate: string;
//   endDate: string;
//   location: string;
//   lat: number;
//   lon: number;
//   is_public: boolean;
// }
