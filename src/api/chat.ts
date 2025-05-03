import { AxiosResponse } from 'axios'
import { api } from '../boot/axios'
import { ChatEntity } from '../types'
import { MatrixMessage } from '../types/matrix'
import { RouteQueryAndHash } from 'vue-router'
import { matrixApi } from './matrix'
import { Socket } from 'socket.io-client'

export const chatApi = {
  // Get list of chat rooms for the current user
  getChatList: (query: RouteQueryAndHash = {}): Promise<AxiosResponse<{ chats: ChatEntity[]; chat: ChatEntity | null }>> =>
    api.get('/api/chat', { params: query }),

  // Send a message to a specific room
  sendMessage: (slug: string, message: string) =>
    api.post(`/api/chat/${slug}/message`, { message }),

  // Event discussion endpoints
  sendEventMessage: (eventSlug: string, message: string): Promise<AxiosResponse<{ id: string }>> =>
    api.post(`/api/chat/event/${eventSlug}/message`, { message }),

  getEventMessages: (eventSlug: string, limit?: number, from?: string): Promise<AxiosResponse<{ messages: MatrixMessage[], end: string, roomId?: string }>> =>
    api.get(`/api/chat/event/${eventSlug}/messages`, { params: { limit, from } }),

  addMemberToEventDiscussion: (eventSlug: string, userSlug: string): Promise<AxiosResponse<{
    success?: boolean;
    roomId?: string;
    message?: string;
  }>> =>
    api.post(`/api/chat/event/${eventSlug}/members/${userSlug}`, {}),

  removeMemberFromEventDiscussion: (eventSlug: string, userSlug: string): Promise<AxiosResponse<void>> =>
    api.delete(`/api/chat/event/${eventSlug}/members/${userSlug}`),

  // Group discussion endpoints
  sendGroupMessage: (groupSlug: string, message: string): Promise<AxiosResponse<{ id: string }>> =>
    api.post(`/api/chat/group/${groupSlug}/message`, { message }),

  getGroupMessages: (groupSlug: string, limit?: number, from?: string): Promise<AxiosResponse<{ messages: MatrixMessage[], end: string, roomId?: string }>> =>
    api.get(`/api/chat/group/${groupSlug}/messages`, { params: { limit, from } }),

  // Mark messages as read
  setMessagesRead: (messageIds: number[]) =>
    api.post('/api/chat/messages/read', { messages: messageIds }),

  // Send typing indicator
  sendTyping: (roomId: string, isTyping: boolean): Promise<AxiosResponse<void>> =>
    api.post(`/api/matrix/${roomId}/typing`, { isTyping }),

  // Create WebSocket connection for chat events (reuse Matrix WebSocket)
  createSocketConnection: (): Socket => {
    // Reuse the matrix API's createSocketConnection method to ensure consistency
    return matrixApi.createSocketConnection()
  },

  // Legacy method for backward compatibility - throws error to identify usage
  createEventSource: (): EventSource => {
    console.error('EventSource is no longer supported - please update your code to use WebSocket')
    throw new Error('EventSource is deprecated in favor of WebSockets for chat events')
  }
}
