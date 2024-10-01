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

export interface StoreAuthRestorePasswordRequest {
  password: string
  hash: string
}

export interface StoreAuthForgotPasswordRequest {
  email: string
}

export interface StoreAuthUserRequest {
  id: string
  email: string
  name?: string
  token: string
  refreshToken: string
}
