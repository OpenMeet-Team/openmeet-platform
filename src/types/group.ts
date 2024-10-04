import { Category, UploadedFile } from 'src/types/model.ts'

export interface Group {
  id: number;
  name: string;
  description: string;
  categories: Category[];
  location: string;
  image?: UploadedFile
  organizerId?: string;
  members?: string[]; // Array of user IDs
  createdAt?: Date;
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
