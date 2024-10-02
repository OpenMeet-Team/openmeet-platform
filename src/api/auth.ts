import { AxiosResponse } from 'axios'
import { api } from 'src/boot/axios'
import {
  ApiAuthForgotPasswordRequest,
  ApiAuthLoginRequest,
  ApiAuthLoginResponse,
  ApiAuthPatchMeRequest,
  ApiAuthRefreshTokenResponse,
  ApiAuthRegisterRequest,
  ApiAuthRestorePasswordRequest,
  ApiAuthUser,
  ApiUserRightsResponse
} from 'src/types'

const BASE_URL = '/api/v1/auth'

export const authApi = {
  login: (credentials: ApiAuthLoginRequest): Promise<AxiosResponse<ApiAuthLoginResponse>> =>
    api.post(`${BASE_URL}/email/login`, credentials),

  register: (credentials: ApiAuthRegisterRequest): Promise<AxiosResponse<ApiAuthLoginResponse>> =>
    api.post(`${BASE_URL}/email/register`, credentials),

  forgotPassword: (data: ApiAuthForgotPasswordRequest): Promise<AxiosResponse<void>> =>
    api.post(`${BASE_URL}/forgot/password`, data),

  restorePassword: (data: ApiAuthRestorePasswordRequest): Promise<AxiosResponse<void>> =>
    api.post(`${BASE_URL}/reset/password`, data),

  getMe: (): Promise<AxiosResponse<ApiAuthUser>> =>
    api.get(`${BASE_URL}/me`),

  updateMe: (data: ApiAuthPatchMeRequest): Promise<AxiosResponse<ApiAuthUser>> =>
    api.patch(`${BASE_URL}/me`, data),

  deleteMe: (): Promise<AxiosResponse<void>> =>
    api.delete(`${BASE_URL}/me`),

  refreshToken: (refreshToken: string): Promise<AxiosResponse<ApiAuthRefreshTokenResponse>> =>
    api.post(`${BASE_URL}/refresh`, null, {
      headers: { Authorization: `Bearer ${refreshToken}` }
    }),

  logout: (): Promise<AxiosResponse<void>> =>
    api.post(`${BASE_URL}/logout`),

  getRights: (): Promise<AxiosResponse<ApiUserRightsResponse>> =>
    api.get(`${BASE_URL}/rights`)
}
