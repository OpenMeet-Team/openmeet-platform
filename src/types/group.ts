import { CategoryEntity, DiscussionEntity, FileEntity, Pagination } from 'src/types/model.ts'
import { UserEntity } from 'src/types/user.ts'
import { EventEntity } from 'src/types/event.ts'

export type GroupVisibilityType = 'public' | 'authenticated' | 'private'
export enum GroupVisibility {
  Public = 'public',
  Authenticated = 'authenticated',
  Private = 'private'
}

export enum GroupStatus {
  Draft = 'draft',
  Pending = 'pending',
  Published = 'published'
}

export enum GroupRole {
  Owner = 'owner',
  Admin = 'admin',
  Moderator = 'moderator',
  Member = 'member',
  Guest = 'guest'
}

export interface GroupCategoryEntity extends CategoryEntity {}

export interface GroupDiscussionEntity extends DiscussionEntity {}

export interface GroupPermissionEntity {
  id: number
  name: string
}

export interface GroupRoleEntity {
  id: number
  name: GroupRole,
  groupPermissions: GroupPermissionEntity[]
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
  visibility: GroupVisibility
  status: GroupStatus,
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

export enum GroupPermission {
  ManageGroup = 'MANAGE_GROUP',
  ManageMembers = 'MANAGE_MEMBERS',
  ManageEvents = 'MANAGE_EVENTS',
  ManageDiscussions = 'MANAGE_DISCUSSIONS',
  ManageReports = 'MANAGE_REPORTS',
  ManageBilling = 'MANAGE_BILLING',
  CreateEvent = 'CREATE_EVENT',
  MessageDiscussion = 'MESSAGE_DISCUSSION',
  MessageMember = 'MESSAGE_MEMBER',
  SeeMembers = 'SEE_MEMBERS',
  SeeEvents = 'SEE_EVENTS',
  SeeDiscussions = 'SEE_DISCUSSIONS',
  SeeGroup = 'SEE_GROUP',
  DeleteGroup = 'DELETE_GROUP'
}

export interface GroupPaginationEntity extends Pagination<GroupEntity> {}
