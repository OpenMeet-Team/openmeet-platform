import { CategoryEntity, DiscussionEntity, FileEntity, Pagination } from 'src/types/model.ts'
import { UserEntity } from 'src/types/user.ts'
import { EventEntity } from 'src/types/event.ts'

export type GroupVisibilityType = 'public' | 'authenticated' | 'private'
export type GroupStatusType = 'draft' | 'pending' | 'published'
export type GroupRoleType = 'owner' | 'admin' | 'moderator' | 'member' | 'guest'

export interface GroupCategoryEntity extends CategoryEntity {}

export interface GroupDiscussionEntity extends DiscussionEntity {}

export interface GroupPermissionEntity {
  id: number
  name: string
}

export interface GroupRoleEntity {
  id: number
  name: GroupRoleType,
}
export interface GroupMemberEntity {
  id: number
  user: UserEntity
  // eslint-disable-next-line no-use-before-define
  group: GroupEntity
  groupRole: GroupRoleEntity
  groupPermissions: GroupPermissionEntity[]
  createdAt?: string
  updatedAt?: string
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
  categories?: GroupCategoryEntity[] | number[]
  location?: string
  lat?: number
  lon?: number
  image?: FileEntity
  organizerId?: string
  membersCount?: number
  groupMembers?: GroupMemberEntity[]
  events?: EventEntity[]
  discussions?: GroupDiscussionEntity[]
  visibility?: GroupVisibilityType
  status?: GroupStatusType,
  createdBy?: UserEntity
  userGroupRole?: never
  groupMembersCount?: number
  requireApproval?: boolean
  groupMember?: GroupMemberEntity
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
