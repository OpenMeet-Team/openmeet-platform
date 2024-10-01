import { api } from 'boot/axios.ts'

export function searchEvents (query: string) {
  return api.get(`/api/v1/search/events?q=${query}`)
}
