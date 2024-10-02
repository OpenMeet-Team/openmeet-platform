export interface Group {
  id: string;
  name: string;
  description: string;
  category: string;
  location: string;
  organizerId: string;
  members: string[]; // Array of user IDs
  createdAt: Date;
}

export const GroupRoles = {
  OWNER: 'owner',
  MANAGER: 'manager',
  MEMBER: 'member'
}

export const GroupPermissions = {
  CAN_CHAT: 'can_chat',
  CAN_POST_FILES: 'can_post_files'
}
