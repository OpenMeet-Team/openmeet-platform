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

// export interface User {
//   id: string;
//   name: string;
//   email: string;
//   role: UserRole;
//   bio?: string;
//   avatar?: string;
//   joinedAt: Date;
// }

export interface UserEntity {
  id: string
  email: string
  name?: string
  token: string
  refreshToken: string
}
