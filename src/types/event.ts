import { UploadedFile, Location } from 'src/types/model.ts'

export type EventType = 'online' | 'in-person' | 'hybrid';

export interface EventData {
  id: string
  title: string
  startDate: string
  startTime: string
  endDate?: string
  endTime?: string
  type: EventType
  location: Location
  onlineLocation: string
  image?: UploadedFile
  description?: string
  maxAttendees?: number
  categories: string[]
  groupId?: string
  userId: string
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
