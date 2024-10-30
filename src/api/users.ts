import { api } from 'boot/axios'
import { UserEntity } from 'src/types'

export const usersApi = {
  getById: (id: string) => api.get<UserEntity>(`/api/v1/users/${id}`),
  getProfile: (id: string) => api.get<UserEntity>(`/api/v1/users/${id}/profile`)
}
