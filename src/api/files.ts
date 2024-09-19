import { AxiosResponse } from 'axios'
import { api } from 'src/boot/axios.ts'

export function apiFilesUpload (formData: FormData): Promise<AxiosResponse> {
  return api.post('/api/v1/files/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
}
