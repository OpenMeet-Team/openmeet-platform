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
  confirmPassword: string
  name?: string
}

export interface ForgotPasswordCredentials {
  email: string
}

export interface RestorePasswordCredentials {
  email: string
  password: string
  token: string
}

export interface RefreshToken {
  refreshToken: string
}
