// types/authTypes.ts

export interface User {
  id: string
  email: string
  name?: string
  token: string
  refreshToken: string
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterCredentials {
  email: string
  password: string
  firstName?: string
  lastName?: string
}

export interface ForgotPasswordCredentials {
  email: string
}

export interface RestorePasswordCredentials {
  password: string
  hash: string
}

export interface RefreshTokenCredentials {
  token: string,
  refreshToken: string,
  tokenExpires: 0
}

export interface PatchMeCredentials {
  photo?: {
    id: string
  },
  firstName?: string,
  lastName?: string,
  email?: string,
  password?: string,
  oldPassword?: string
}
