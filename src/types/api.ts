import { UserEntity } from '../types'

export interface ApiAuthUser extends UserEntity {
  token?: string
  refreshToken?: string
}

export interface ApiAuthLoginResponse {
  token: string
  refreshToken: string
  tokenExpires: number
  user: ApiAuthUser
  profile?: {
    did?: string
    handle?: string
    [key: string]: unknown
  }
}

export interface ApiAuthForgotPasswordRequest {
  email: string
}

export interface ApiAuthRestorePasswordRequest {
  password: string
  hash: string
}

export interface ApiAuthRefreshTokenResponse {
  token: string,
  refreshToken: string,
  tokenExpires: number
}
