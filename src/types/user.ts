import { AuthProvidersEnum, FileEntity, SubCategoryEntity } from './model'
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

export interface UserLocation {
  lat: number
  lon: number
  address: string
}

export interface BlueskyPreferences {
  did?: string
  handle?: string
  avatar?: string
  connected?: boolean
  disconnectedAt?: Date | null
  connectedAt?: Date | null
}

export interface MatrixPreferences {
  connected?: boolean
  disconnectedAt?: Date | null
  connectedAt?: Date | null
  // We don't store the Matrix password, but we use this property
  // for setting a new password via the API
  password?: string
  lastPasswordChanged?: Date | null

  // Flag to indicate if the user has set a direct client password
  hasDirectAccess?: boolean
}

export interface UserPreferences {
  bluesky?: BlueskyPreferences
  matrix?: MatrixPreferences
}

export interface Profile {
  id: number
  slug: string
  ulid: string
  email: string
  firstName?: string | null
  lastName?: string | null
  bio?: string
  photo?: FileEntity | null
  oldPassword?: string
  password?: string
  location?: UserLocation
  preferences?: UserPreferences
  interests?: SubCategoryEntity[]
}

export interface UserEntity {
  id: number
  ulid: string
  slug: string
  email: string
  name?: string
  provider?: AuthProvidersEnum
  socialId?: string
  firstName?: string
  lastName?: string
  shortId?: string
  // token: string
  // refreshToken: string
  zulipUserId?: number
  zulipUsername?: string
  zulipApiKey?: string
  // Matrix fields - only matrixUserId is needed client-side
  // Server now manages credentials securely
  matrixUserId?: string
  photo?: FileEntity
  bio?: string
  role?: UserRoleEntity
  groups?: GroupEntity[]
  events?: EventEntity[]
  groupMembers?: GroupMemberEntity[]
  interests?: SubCategoryEntity[]
  preferences?: UserPreferences
}
