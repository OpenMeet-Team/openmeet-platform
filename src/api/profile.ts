import { api } from 'boot/axios.ts'

interface Profile {
  name: string
}
export function getProfile (userId: string) {
  return api.get(`/profiles/${userId}`)
}

export function updateProfile (userId: string, profileData: Profile) {
  return api.put(`/profiles/${userId}`, profileData)
}
