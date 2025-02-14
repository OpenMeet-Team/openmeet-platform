import { UserEntity } from './user'

export interface ApiAuthUser extends UserEntity {}

export interface ApiAuthLoginResponse {
  token: string
  refreshToken: string
  tokenExpires: number
  user: ApiAuthUser
}

export interface ApiAuthRefreshTokenResponse {
  token: string
  refreshToken: string
  tokenExpires: number
}

export interface ApiAuthForgotPasswordRequest {
  email: string
}

export interface ApiAuthRestorePasswordRequest {
  hash: string
  password: string
}

export interface StoreAuthLoginRequest {
  email: string
  password: string
}

export interface StoreAuthRegisterRequest {
  email: string
  password: string
  firstName?: string
  lastName?: string
}

export interface StoreAuthForgotPasswordRequest {
  email: string
}

export interface StoreAuthRestorePasswordRequest {
  hash: string
  password: string
}
