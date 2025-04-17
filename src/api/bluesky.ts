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
  },
  adminResetSession: (did: string) => {
    // This endpoint is only accessible to admin users
    return api.post(`${BASE_URL}/admin/session/reset/${encodeURIComponent(did)}`)
  }
}
