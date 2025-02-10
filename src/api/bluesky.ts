import { api } from '../boot/axios'

const BASE_URL = '/api/bluesky'

export const blueskyApi = {
  listEvents: (did: string) => {
    return api.get(`${BASE_URL}/events/${did}`)
  }
}
