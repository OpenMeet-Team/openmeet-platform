import { api } from 'boot/axios.ts'
import { Event } from 'src/types/eventTypes.ts'

export function createEvent (eventData: Event) {
  return api.post('/api/events', eventData)
}

export function getEvents () {
  return api.get('/api/events')
}

export function getEventById (eventId: string) {
  return api.get(`/api/events/${eventId}`)
}

export function updateEvent (eventId: string, eventData: Event) {
  return api.put(`/api/events/${eventId}`, eventData)
}

export function deleteEvent (eventId: string) {
  return api.delete(`/api/events/${eventId}`)
}

export function registerForEvent (eventId: string, userId: string) {
  return api.post(`/api/events/${eventId}/register`, { userId })
}

export function cancelRegistration (eventId: string, userId: string) {
  return api.delete(`/api/events/${eventId}/register/${userId}`)
}
