import { api } from 'boot/axios'
import { Category } from 'src/types'

export const categoriesApi = {
  getAll: () => api.get<Category[]>('/api/categories'),
  getById: (id: string) => api.get<Category>(`/api/categories/${id}`),
  create: (category: Partial<Category>) => api.post<Category>('/api/categories', category),
  update: (id: number, category: Partial<Category>) => api.put<Category>(`/api/categories/${id}`, category),
  delete: (id: number) => api.delete(`/api/categories/${id}`)
}
