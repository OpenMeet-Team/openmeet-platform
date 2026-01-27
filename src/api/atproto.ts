import { AxiosResponse } from 'axios'
import { api } from '../boot/axios'
import type { AtprotoIdentityDto, AtprotoRecoveryStatusDto, TakeOwnershipInitiateResponseDto } from '../types/atproto'

const BASE_URL = '/api/atproto'

export const atprotoApi = {
  /**
   * Get the current user's AT Protocol identity
   */
  getIdentity: (): Promise<AxiosResponse<AtprotoIdentityDto>> =>
    api.get(`${BASE_URL}/identity`),

  /**
   * Create an AT Protocol identity for the current user
   */
  createIdentity: (): Promise<AxiosResponse<AtprotoIdentityDto>> =>
    api.post(`${BASE_URL}/identity`),

  /**
   * Check if the current user can recover an existing AT Protocol identity
   */
  getRecoveryStatus: (): Promise<AxiosResponse<AtprotoRecoveryStatusDto>> =>
    api.get(`${BASE_URL}/identity/recovery-status`),

  /**
   * Recover existing AT Protocol identity as custodial (OpenMeet manages credentials)
   */
  recoverAsCustodial: (): Promise<AxiosResponse<AtprotoIdentityDto>> =>
    api.post(`${BASE_URL}/identity/recover-as-custodial`),

  /**
   * Initiate take ownership flow - sends PDS password reset email
   * @returns The email address where the password reset was sent
   */
  initiateTakeOwnership: (): Promise<AxiosResponse<TakeOwnershipInitiateResponseDto>> =>
    api.post(`${BASE_URL}/identity/take-ownership/initiate`),

  /**
   * Complete take ownership flow - marks identity as non-custodial
   * @returns Success status
   */
  completeTakeOwnership: (): Promise<AxiosResponse<{ success: boolean }>> =>
    api.post(`${BASE_URL}/identity/take-ownership/complete`),

  /**
   * Reset PDS password using the token from the password reset email
   * This calls the PDS directly via our backend proxy
   * @param token - The reset token from the email
   * @param password - The new password
   * @returns Success status
   */
  resetPdsPassword: (token: string, password: string): Promise<AxiosResponse<{ success: boolean }>> =>
    api.post(`${BASE_URL}/identity/reset-pds-password`, { token, password })
}
