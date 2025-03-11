import { AxiosResponse } from 'axios'
import { api } from '../boot/axios'
import { ChatEntity } from '../types'
import { RouteQueryAndHash } from 'vue-router'

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

  // Create SSE connection for Matrix events
  createEventSource: (): EventSource => {
    return new EventSource('/api/matrix/events', { withCredentials: true })
  }
}
