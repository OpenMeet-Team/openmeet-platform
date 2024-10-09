import { CategoryEntity, UploadedFileEntity } from 'src/types/model.ts'

interface GroupMemberEntity {
  id: number;
  name: string;
  role: string;
  avatar: string;
}
interface GroupEventEntity {
  id: number;
  name: string;
  startDate: string;
  type: string
}

export interface GroupEntity {
  id: number
  name: string
  description?: string
  categories?: CategoryEntity[]
  location?: string
  image?: UploadedFileEntity
  organizerId?: string
  membersCount?: number
  members?: GroupMemberEntity[]
  events?: GroupEventEntity[]
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
