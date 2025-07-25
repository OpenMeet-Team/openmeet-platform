import { api } from '../boot/axios'
import { UserEntity } from '../types'

export const usersApi = {
  getById: (id: string) => api.get<UserEntity>(`/api/v1/users/${id}`),
  getMemberProfile: (slug: string) => api.get<UserEntity>(`/api/v1/users/${slug}/profile`),

  // TODO: Backend needs to implement this endpoint
  // Search for users by name/handle for direct message creation
  search: (query: { search: string, limit?: number }) =>
    api.get<UserEntity[]>('/api/users/search', { params: query })
}
