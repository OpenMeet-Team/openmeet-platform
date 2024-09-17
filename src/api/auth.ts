// api/auth.ts
import { AxiosResponse } from 'axios'
import { api } from 'boot/axios'
import {
  LoginCredentials,
  RegisterCredentials,
  ForgotPasswordCredentials,
  RestorePasswordCredentials,
  RefreshToken
} from 'src/types/authTypes.ts'

export function apiLogin (credentials: LoginCredentials): Promise<AxiosResponse> {
  return api.post('/auth/login', credentials)
}

export function apiRegister (credentials: RegisterCredentials): Promise<AxiosResponse> {
  return api.post('/auth/register', credentials)
}

export function apiForgotPassword (credentials: ForgotPasswordCredentials): Promise<AxiosResponse> {
  return api.post('/auth/forgot-password', credentials)
}

export function apiRestorePassword (credentials: RestorePasswordCredentials): Promise<AxiosResponse> {
  return api.post('/auth/restore-password', credentials)
}

export function apiRefreshToken (refreshToken: RefreshToken): Promise<AxiosResponse> {
  return api.post('/auth/refresh-token', refreshToken)
}

export function apiLogout (): Promise<AxiosResponse> {
  return api.post('/auth/logout')
}
