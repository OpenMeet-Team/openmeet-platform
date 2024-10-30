import { FileEntity, SubCategoryEntity } from 'src/types/model.ts'
import { GroupEntity, GroupMemberEntity } from './group'
import { EventEntity } from './event'

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
}

export enum UserPermission {
  CREATE_EVENT = 'create_event',
  DELETE_EVENT = 'delete_event',
  CREATE_GROUP = 'create_group',
  DELETE_GROUP = 'delete_group',
  MANAGE_USERS = 'manage_users'
}

export interface UserEntity {
  id: number
  email: string
  name?: string
  firstName?: string
  lastName?: string
  // token: string
  // refreshToken: string
  photo?: FileEntity
  bio?: string
  role?: UserRole
  groups?: GroupEntity[]
  events?: EventEntity[]
  groupMembers?: GroupMemberEntity[]
  permissions?: UserPermission[]
  subCategory?: SubCategoryEntity[]
}
