import { AxiosResponse } from 'axios'
import { api } from '../boot/axios'
import type { AtprotoIdentityDto, AtprotoRecoveryStatusDto } from '../types/atproto'

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
    api.post(`${BASE_URL}/identity/recover-as-custodial`)
}
