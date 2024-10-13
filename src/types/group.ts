import { CategoryEntity, Pagination, UploadedFileEntity } from 'src/types/model.ts'
import { UserEntity } from 'src/types/user.ts'

export type GroupVisibilityType = 'public' | 'authenticated' | 'private'
export type GroupStatusType = 'draft' | 'pending' | 'published'

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
  lat?: number
  lon?: number
  image?: UploadedFileEntity
  organizerId?: string
  membersCount?: number
  members?: GroupMemberEntity[]
  events?: GroupEventEntity[]
  visibility?: GroupVisibilityType
  status?: GroupStatusType,
  user?: UserEntity
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

export interface GroupPaginationEntity extends Pagination<GroupEntity> {}
