import { api } from 'boot/axios.ts'

export function apiGroups () {
  return api.get('/api/v1/groups')
}

export function getGroupById (groupId: string) {
  return api.get(`/api/v1/groups/${groupId}`)
}

export function registerForGroup (groupId: string, userId: string) {
  return api.post(`/api/v1/groups/${groupId}/register`, { userId })
}

export function cancelRegistration (groupId: string, userId: string) {
  return api.delete(`/api/v1/events/${groupId}/register/${userId}`)
}
