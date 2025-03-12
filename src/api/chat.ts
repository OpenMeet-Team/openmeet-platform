import { AxiosResponse } from 'axios'
import { api } from '../boot/axios'
import { ChatEntity } from '../types'
import { RouteQueryAndHash } from 'vue-router'
import { matrixApi } from './matrix'
import { Socket } from 'socket.io-client'

export const chatApi = {
  // Get list of chat rooms for the current user
  getChatList: (query: RouteQueryAndHash = {}): Promise<AxiosResponse<{ chats: ChatEntity[]; chat: ChatEntity | null }>> =>
    api.get('/api/chat', { params: query }),

  // Send a message to a specific room
  sendMessage: (ulid: string, message: string) =>
    api.post(`/api/chat/${ulid}/message`, { content: message }),

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
