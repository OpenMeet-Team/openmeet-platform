import { CategoryEntity, DiscussionEntity, FileEntity, Pagination } from 'src/types/model.ts'
import { UserEntity } from 'src/types/user.ts'
import { EventEntity } from 'src/types/event.ts'

export type GroupVisibilityType = 'public' | 'authenticated' | 'private'
export type GroupStatusType = 'draft' | 'pending' | 'published'
export type GroupRoleType = 'owner' | 'manager' | 'member'

export interface GroupRoleEntity {
  id: number
  name: GroupRoleType,
}
export interface GroupMemberEntity {
  id: number
  user: UserEntity
  groupRole: GroupRoleEntity
}
export interface GroupEventEntity {
  id: number;
  name: string;
  startDate: string;
  type: string
}

export interface GroupEntity {
  id: number
  slug: string
  name: string
  description?: string
  categories?: CategoryEntity[]
  location?: string
  lat?: number
  lon?: number
  image?: FileEntity
  organizerId?: string
  membersCount?: number
  groupMembers?: GroupMemberEntity[]
  events?: EventEntity[]
  discussions?: DiscussionEntity[]
  visibility?: GroupVisibilityType
  status?: GroupStatusType,
  createdBy?: UserEntity
  userGroupRole?: never
  groupMembersCount?: number
  requireApproval?: boolean
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
