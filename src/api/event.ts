// src/services/event.ts

import { api } from 'boot/axios.ts'

export function createEvent (eventData: Event) {
  return api.post('/events', eventData)
}

export function getEvents () {
  return api.get('/events')
}

export function getEventById (eventId: string) {
  return api.get(`/events/${eventId}`)
}

export function updateEvent (eventId: string, eventData: Event) {
  return api.put(`/events/${eventId}`, eventData)
}

export function deleteEvent (eventId: string) {
  return api.delete(`/events/${eventId}`)
}

export function registerForEvent (eventId: string, userId: string) {
  return api.post(`/events/${eventId}/register`, { userId })
}

export function cancelRegistration (eventId: string, userId: string) {
  return api.delete(`/events/${eventId}/register/${userId}`)
}
