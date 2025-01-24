import { api } from '../boot/axios'
import { UserEntity } from '../types'

export const usersApi = {
  getById: (id: string) => api.get<UserEntity>(`/api/v1/users/${id}`),
  getMemberProfile: (slug: string) => api.get<UserEntity>(`/api/v1/users/${slug}/profile`)
}
