import { Category, UploadedFile } from 'src/types/model.ts'

export interface GroupEntity {
  id: number
  name: string
  description?: string
  categories?: Category[] | number[]
  location?: string
  image?: UploadedFile
  organizerId?: string
  members?: string[]
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
