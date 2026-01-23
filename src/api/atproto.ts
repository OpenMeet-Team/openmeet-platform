import { AxiosResponse } from 'axios'
import { api } from '../boot/axios'
import type { AtprotoIdentityDto } from '../types/atproto'

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
    api.post(`${BASE_URL}/identity`)
}
