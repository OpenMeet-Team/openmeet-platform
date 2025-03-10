export interface MatrixMessage {
  event_id: string;
  room_id: string;
  sender: string;
  content: {
    msgtype: string;
    body: string;
    formatted_body?: string;
    format?: string;
    topic?: string;
  };
  origin_server_ts: number;
  type: string;
  unsigned?: {
    age: number;
    transaction_id?: string;
  };
}

export interface MatrixRoom {
  id: string;
  name: string;
  topic: string;
  avatarUrl?: string;
  isPublic: boolean;
  memberCount: number;
}

export interface MatrixUser {
  id: string;
  displayName: string;
  avatarUrl?: string;
}
