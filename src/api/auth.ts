// api/auth.ts
import { AxiosResponse } from 'axios'
import { api } from 'boot/axios'
import {
  LoginCredentials,
  RegisterCredentials,
  ForgotPasswordCredentials,
  RestorePasswordCredentials,
  PatchMeCredentials
} from 'src/types/authTypes.ts'

export function apiLogin (credentials: LoginCredentials): Promise<AxiosResponse> {
  return api.post('/api/v1/auth/email/login', credentials)
}

export function apiRegister (credentials: RegisterCredentials): Promise<AxiosResponse> {
  return api.post('/api/v1/auth/email/register', credentials)
}

export function apiForgotPassword (credentials: ForgotPasswordCredentials): Promise<AxiosResponse> {
  return api.post('/api/v1/auth/forgot/password', credentials)
}

export function apiRestorePassword (credentials: RestorePasswordCredentials): Promise<AxiosResponse> {
  return api.post('/api/v1/auth/reset/password', credentials)
}

export function apiGetMe (): Promise<AxiosResponse> {
  return api('/api/v1/auth/me')
}

export function apiUpdateMe (credentials: PatchMeCredentials): Promise<AxiosResponse> {
  return api.patch('/api/v1/auth/me', credentials)
}
export function apiDeleteMe (): Promise<AxiosResponse> {
  return api.delete('/api/v1/auth/me')
}

export function apiRefreshToken (refreshToken: string): Promise<AxiosResponse> {
  return api.post('/api/v1/auth/refresh', null, { headers: { Authorization: `Bearer ${refreshToken}` } })
}

export function apiLogout (): Promise<AxiosResponse> {
  return api.post('/api/v1/auth/logout')
}
