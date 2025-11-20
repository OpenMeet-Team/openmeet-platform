import { CategoryEntity, FileEntity, Pagination } from './model'
import { MatrixMessage } from './matrix'
import { UserEntity } from './user'
import { EventEntity } from './event'

export type GroupVisibilityType = 'public' | 'unlisted' | 'private'
export enum GroupVisibility {
  Public = 'public',
  Unlisted = 'unlisted',
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
  ulid: string
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
  topics?: { name: string }[]
  messages?: MatrixMessage[]
  roomId?: string
  visibility: GroupVisibility
  status: GroupStatus,
  createdBy?: UserEntity
  userGroupRole?: never
  groupMembersCount?: number
  requireApproval?: boolean
  requireGroupMembership?: boolean
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
  ContactMembers = 'CONTACT_MEMBERS',
  ContactAdmins = 'CONTACT_ADMINS',
  SeeMembers = 'SEE_MEMBERS',
  SeeEvents = 'SEE_EVENTS',
  SeeDiscussions = 'SEE_DISCUSSIONS',
  SeeGroup = 'SEE_GROUP',
  DeleteGroup = 'DELETE_GROUP'
}

export interface GroupPaginationEntity extends Pagination<GroupEntity> {}
