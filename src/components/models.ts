export interface Todo {
  id: number;
  content: string;
}

export interface Meta {
  totalCount: number;
}

export interface Event {
  id: number;
  title: string;
  description: string;
  date: string;
  time?: string;
  location: string;
  imageUrl?: string;
  attendees?: number;
  maxAttendees?: number;
  hostingGroup?: string;
}
