// src/services/comments.ts

import { api } from 'boot/axios.ts'

export function addComment (eventId: string, comment: string) {
  return api.post(`/events/${eventId}/comments`, { comment })
}

export function getComments (eventId: string) {
  return api.get(`/events/${eventId}/comments`)
}

export function deleteComment (eventId: string, commentId: string) {
  return api.delete(`/events/${eventId}/comments/${commentId}`)
}
