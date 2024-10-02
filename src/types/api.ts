import { UserPermission, UserRole, UploadedFile } from 'src/types'

export interface ApiAuthUser {
  id: string
  email: string
  name?: string,
  firstName?: string
  lastName?: string
  photo?: UploadedFile
  token: string
  refreshToken: string
}

export interface ApiAuthLoginRequest {
  email: string
  password: string
}

export interface ApiAuthLoginResponse {
  token: string
  refreshToken: string
  tokenExpires: number
  user: ApiAuthUser
}

export interface ApiAuthRegisterRequest {
  email: string
  password: string
  firstName?: string
  lastName?: string
}

export interface ApiAuthForgotPasswordRequest {
  email: string
}

export interface ApiAuthRestorePasswordRequest {
  password: string
  hash: string
}

export interface ApiAuthPatchMeRequest {
  photo?: {
    id: string
  },
  firstName?: string,
  lastName?: string,
  email?: string,
  password?: string,
  oldPassword?: string
}

export interface ApiAuthRefreshTokenResponse {
  token: string,
  refreshToken: string,
  tokenExpires: number
}

export interface ApiUserRightsResponse {
  role: UserRole;
  permissions: UserPermission[];
}
