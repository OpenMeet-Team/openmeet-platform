import { api } from 'boot/axios.ts'

export function searchEvents (query: string) {
  return api.get(`/search/events?q=${query}`)
}
