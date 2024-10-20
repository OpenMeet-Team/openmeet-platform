import { api } from 'boot/axios'
import { SubCategoryEntity } from 'src/types'

export const subcategoriesApi = {
  getAll: () => api.get<SubCategoryEntity[]>('/api/subcategories'),
  getById: (id: string) => api.get<SubCategoryEntity>(`/api/subcategories/${id}`),
  create: (subcategory: Partial<SubCategoryEntity>) => api.post<SubCategoryEntity>('/api/subcategories', subcategory),
  update: (id: number, subcategory: Partial<SubCategoryEntity>) => api.put<SubCategoryEntity>(`/api/subcategories/${id}`, subcategory),
  delete: (id: number) => api.delete(`/api/subcategories/${id}`)
}
