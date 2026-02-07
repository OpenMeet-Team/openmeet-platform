import { AxiosResponse } from 'axios'
import { api } from '../boot/axios'
import {
  ApiAuthForgotPasswordRequest,
  ApiAuthLoginResponse,
  ApiAuthRefreshTokenResponse,
  ApiAuthRestorePasswordRequest,
  ApiAuthUser,
  SubCategoryEntity,
  UserPreferences
} from '../types'
import getEnv from '../utils/env'
const BASE_URL = '/api/v1/auth'

export const authApi = {
  login: (credentials: {
    email: string
    password: string
  }): Promise<AxiosResponse<ApiAuthLoginResponse>> =>
    api.post(`${BASE_URL}/email/login`, credentials, { withCredentials: true }),

  register: (credentials: {
    email: string
    password: string
    firstName?: string
    lastName?: string
  }): Promise<AxiosResponse<ApiAuthLoginResponse>> =>
    api.post(`${BASE_URL}/email/register`, credentials, { withCredentials: true }),

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
    interests?: SubCategoryEntity[],
    preferences?: Partial<UserPreferences>
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
    api.post(`${BASE_URL}/google/login`, { idToken }, { withCredentials: true }),

  googleOAuth2Login: (data: { code: string; redirectUri: string; state?: string }): Promise<AxiosResponse<ApiAuthLoginResponse>> =>
    api.post(`${BASE_URL}/google/oauth2/callback`, data, { withCredentials: true }),

  githubLogin: (code: string): Promise<AxiosResponse<ApiAuthLoginResponse>> =>
    api.post(`${BASE_URL}/github/login`, { code }, { withCredentials: true }),

  blueskyLogin: (handle: string): Promise<AxiosResponse<ApiAuthLoginResponse>> =>
    api.post(`${BASE_URL}/bluesky/authorize`, { handle }, { withCredentials: true }),

  devLogin: (credentials: { identifier: string, password: string }) => {
    if (getEnv('NODE_ENV') !== 'development') {
      throw new Error('Dev login only available in development')
    }
    const tenantId = getEnv('APP_TENANT_ID')
    if (!tenantId) {
      throw new Error('APP_TENANT_ID is required for dev login')
    }
    return api.post<ApiAuthLoginResponse>(
      `${BASE_URL}/bluesky/dev-login`,
      {
        identifier: credentials.identifier,
        password: credentials.password,
        tenantId
      },
      { withCredentials: true }
    )
  },

  quickRsvp: (data: {
    name: string
    email: string
    eventSlug: string
    status?: 'confirmed' | 'cancelled'
  }): Promise<AxiosResponse<{ success: boolean; message: string; verificationCode?: string }>> =>
    api.post(`${BASE_URL}/quick-rsvp`, data),

  verifyEmailCode: (data: {
    code: string
    email: string
  }): Promise<AxiosResponse<ApiAuthLoginResponse>> =>
    api.post(`${BASE_URL}/verify-email-code`, data, { withCredentials: true }),

  requestLoginCode: (data: {
    email: string
  }): Promise<AxiosResponse<{ success: boolean; message: string }>> =>
    api.post(`${BASE_URL}/request-login-code`, data)
}
