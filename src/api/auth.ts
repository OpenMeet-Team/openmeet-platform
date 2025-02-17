import { AxiosResponse } from 'axios'
import { api } from '../boot/axios'
import {
  ApiAuthForgotPasswordRequest,
  ApiAuthLoginResponse,
  ApiAuthRefreshTokenResponse,
  ApiAuthRestorePasswordRequest,
  ApiAuthUser,
  SubCategoryEntity
} from '../types'
import getEnv from '../utils/env'
const BASE_URL = '/api/v1/auth'

export const authApi = {
  login: (credentials: {
    email: string
    password: string
  }): Promise<AxiosResponse<ApiAuthLoginResponse>> =>
    api.post(`${BASE_URL}/email/login`, credentials),

  register: (credentials: {
    email: string
    password: string
    firstName?: string
    lastName?: string
  }): Promise<AxiosResponse<ApiAuthLoginResponse>> =>
    api.post(`${BASE_URL}/email/register`, credentials),

  forgotPassword: (data: ApiAuthForgotPasswordRequest): Promise<AxiosResponse<void>> =>
    api.post(`${BASE_URL}/forgot/password`, data),

  restorePassword: (data: ApiAuthRestorePasswordRequest): Promise<AxiosResponse<void>> =>
    api.post(`${BASE_URL}/reset/password`, data),

  getMe: (): Promise<AxiosResponse<ApiAuthUser>> =>
    api.get(`${BASE_URL}/me`),

  confirmEmail: (hash: string): Promise<AxiosResponse<boolean>> =>
    api.post(`${BASE_URL}/email/confirm`, { hash }),

  confirmNewEmail: (hash: string): Promise<AxiosResponse<boolean>> =>
    api.post(`${BASE_URL}/email/confirm/new`, { hash }),

  updateMe: (data: {
    photo?: {
      id: number
    },
    firstName?: string,
    lastName?: string,
    email?: string,
    password?: string,
    oldPassword?: string,
    interests?: SubCategoryEntity[]
  }): Promise<AxiosResponse<ApiAuthUser>> =>
    api.patch(`${BASE_URL}/me`, data),

  deleteMe: (): Promise<AxiosResponse<void>> =>
    api.delete(`${BASE_URL}/me`),

  refreshToken: (refreshToken: string): Promise<AxiosResponse<ApiAuthRefreshTokenResponse>> =>
    api.post(`${BASE_URL}/refresh`, null, {
      headers: { Authorization: `Bearer ${refreshToken}` }
    }),

  logout: (): Promise<AxiosResponse<void>> =>
    api.post(`${BASE_URL}/logout`),

  googleLogin: (idToken: string): Promise<AxiosResponse<ApiAuthLoginResponse>> =>
    api.post(`${BASE_URL}/google/login`, { idToken }),

  githubLogin: (code: string): Promise<AxiosResponse<ApiAuthLoginResponse>> =>
    api.post(`${BASE_URL}/github/login`, { code }),

  blueskyLogin: (handle: string): Promise<AxiosResponse<ApiAuthLoginResponse>> =>
    api.post(`${BASE_URL}/bluesky/authorize`, { handle }),

  devLogin: (credentials: { identifier: string, password: string }) => {
    if (getEnv('NODE_ENV') !== 'development') {
      throw new Error('Dev login only available in development')
    }
    const tenantId = getEnv('APP_TENANT_ID') || 'default'
    return api.post<ApiAuthLoginResponse>(
      `${BASE_URL}/bluesky/dev-login`,
      {
        identifier: credentials.identifier,
        password: credentials.password,
        tenantId
      }
    )
  }
}
