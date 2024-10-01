import { AxiosResponse } from 'axios'
import { api } from 'boot/axios'
import {
  ApiAuthForgotPasswordRequest,
  ApiAuthLoginRequest,
  ApiAuthLoginResponse, ApiAuthPatchMeRequest, ApiAuthRefreshTokenResponse,
  ApiAuthRegisterRequest, ApiAuthRestorePasswordRequest
} from 'src/types'

export function apiLogin (credentials: ApiAuthLoginRequest): Promise<AxiosResponse<ApiAuthLoginResponse>> {
  return api.post('/api/v1/auth/email/login', credentials)
}

export function apiRegister (credentials: ApiAuthRegisterRequest): Promise<AxiosResponse<ApiAuthLoginResponse>> {
  return api.post('/api/v1/auth/email/register', credentials)
}

export function apiForgotPassword (credentials: ApiAuthForgotPasswordRequest): Promise<AxiosResponse> {
  return api.post('/api/v1/auth/forgot/password', credentials)
}

export function apiRestorePassword (credentials: ApiAuthRestorePasswordRequest): Promise<AxiosResponse> {
  return api.post('/api/v1/auth/reset/password', credentials)
}

export function apiGetMe (): Promise<AxiosResponse> {
  return api('/api/v1/auth/me')
}

export function apiUpdateMe (credentials: ApiAuthPatchMeRequest): Promise<AxiosResponse> {
  return api.patch('/api/v1/auth/me', credentials)
}
export function apiDeleteMe (): Promise<AxiosResponse> {
  return api.delete('/api/v1/auth/me')
}

export function apiRefreshToken (refreshToken: string): Promise<AxiosResponse<ApiAuthRefreshTokenResponse>> {
  return api.post('/api/v1/auth/refresh', null, { headers: { Authorization: `Bearer ${refreshToken}` } })
}

export function apiLogout (): Promise<AxiosResponse> {
  return api.post('/api/v1/auth/logout')
}
