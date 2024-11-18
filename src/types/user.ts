import { FileEntity, SubCategoryEntity } from 'src/types/model.ts'
import { GroupEntity, GroupMemberEntity } from './group'
import { EventEntity } from './event'

export enum UserRole {
  Admin = 'admin',
  User = 'user',
  Editor = 'editor'
}

export enum UserPermission {
  CREATE_EVENT = 'create_event',
  DELETE_EVENT = 'delete_event',
  CREATE_GROUP = 'create_group',
  DELETE_GROUP = 'delete_group',
  MANAGE_USERS = 'manage_users'
}

export interface UserPermissionEntity {
  name: UserPermission
}

export interface UserRoleEntity {
  name: UserRole
  permissions: UserPermissionEntity[]
}

export interface UserEntity {
  id: number
  ulid: string
  email: string
  name?: string
  firstName?: string
  lastName?: string
  shortId?: string
  // token: string
  // refreshToken: string
  zulipUserId?: number
  zulipUsername?: string
  zulipApiKey?: string
  photo?: FileEntity
  bio?: string
  role?: UserRoleEntity
  groups?: GroupEntity[]
  events?: EventEntity[]
  groupMembers?: GroupMemberEntity[]
  subCategory?: SubCategoryEntity[]
}
