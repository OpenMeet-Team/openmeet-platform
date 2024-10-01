import { api } from 'boot/axios.ts'
import { Event } from 'src/types'

export function createEvent (eventData: Event) {
  return api.post('/api/v1/events', eventData)
}

export function apiGetEvents () {
  return api.get('/api/v1/events')
}

export function apiGetEvent (eventId: string) {
  return api.get(`/api/v1/events/${eventId}`)
}

export function updateEvent (eventId: string, eventData: Event) {
  return api.put(`/api/v1/events/${eventId}`, eventData)
}

export function deleteEvent (eventId: string) {
  return api.delete(`/api/v1/events/${eventId}`)
}

export function registerForEvent (eventId: string, userId: string) {
  return api.post(`/api/v1/events/${eventId}/register`, { userId })
}

export function cancelRegistration (eventId: string, userId: string) {
  return api.delete(`/api/v1/events/${eventId}/register/${userId}`)
}
