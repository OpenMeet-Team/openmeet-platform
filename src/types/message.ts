export interface Message {
  id: string;
  content: string;
  senderId: string;
  groupId?: string;
  eventId?: string;
  timestamp: string;
}
