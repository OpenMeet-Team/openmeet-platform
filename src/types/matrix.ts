export interface MatrixMessageContent {
  body: string;
  msgtype: string;
  formatted_body?: string;
  format?: string;
  _clientMsgId?: string;
  [key: string]: unknown;
}

export interface MatrixMessage {
  // Support both naming conventions since API is in transition
  event_id?: string;
  eventId?: string;
  room_id?: string;
  roomId?: string;
  sender: string;
  sender_name?: string; // Added field for OpenMeet display name
  content: MatrixMessageContent;
  origin_server_ts?: number;
  timestamp?: number; // Alternative naming for timestamp
  type?: string;
  unsigned?: {
    age?: number;
    transaction_id?: string;
    [key: string]: unknown;
  };

  // Custom properties added by our system
  _broadcastId?: string;
  _clientMsgId?: string;
  _optimistic?: boolean;

  // Allow other properties
  [key: string]: unknown;
}

export interface MatrixRoomMember {
  userId: string;
  displayName?: string;
  avatarUrl?: string;
  membership?: string;
}

export interface MatrixRoom {
  id: string;
  name: string;
  roomId: string;
  roomAlias?: string;
  topic?: string;
  avatarUrl?: string;
  members?: MatrixRoomMember[];
}

export interface MatrixTypingIndicator {
  room_id: string;
  typing: string[];
}

export interface MatrixEvent {
  type: string;
  content: Record<string, unknown>;
  room_id?: string;
  sender?: string;
  event_id?: string;
  origin_server_ts?: number;
  [key: string]: unknown;
}
