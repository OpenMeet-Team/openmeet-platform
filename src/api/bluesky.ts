import { api } from '../boot/axios'

const BASE_URL = '/api/bluesky'

export const blueskyApi = {
  listEvents: (did: string) => {
    return api.get(`${BASE_URL}/events/${did}`)
  },
  deleteEvent: (did: string, rkey: string) => {
    return api.delete(`${BASE_URL}/events/${did}/${encodeURIComponent(rkey)}`)
  },
  connect: () => {
    return api.post(`${BASE_URL}/connect`)
  },
  disconnect: () => {
    return api.delete(`${BASE_URL}/disconnect`)
  },
  getStatus: () => {
    return api.get(`${BASE_URL}/status`)
  }
}
