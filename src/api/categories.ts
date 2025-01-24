import { api } from '../boot/axios'
import { CategoryEntity } from '../types'

export const categoriesApi = {
  getAll: () => api.get<CategoryEntity[]>('/api/categories'),
  getById: (id: string) => api.get<CategoryEntity>(`/api/categories/${id}`),
  create: (category: Partial<CategoryEntity>) => api.post<CategoryEntity>('/api/categories', category),
  update: (id: number, category: Partial<CategoryEntity>) => api.put<CategoryEntity>(`/api/categories/${id}`, category),
  delete: (id: number) => api.delete(`/api/categories/${id}`)
}
