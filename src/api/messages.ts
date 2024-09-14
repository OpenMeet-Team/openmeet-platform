// src/services/messaging.ts

import { api } from 'boot/axios.ts'

export function sendMessage (senderId: string, receiverId: string, message: string) {
  return api.post('/messages', { senderId, receiverId, message })
}

export function getMessages (conversationId: string) {
  return api.get(`/messages/${conversationId}`)
}
