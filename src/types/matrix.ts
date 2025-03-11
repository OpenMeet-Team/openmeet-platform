export interface MatrixMessage {
  // Support both naming conventions since API is in transition
  event_id?: string;
  eventId?: string;
  room_id?: string;
  roomId?: string;
  sender: string;
  sender_name?: string; // Added field for OpenMeet display name
  content: {
    body: string;
    msgtype: string;
    [key: string]: unknown;
  };
  origin_server_ts?: number;
  timestamp?: number; // Alternative naming for timestamp
  type?: string;
  unsigned?: {
    age?: number;
    transaction_id?: string;
    [key: string]: unknown;
  };
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
