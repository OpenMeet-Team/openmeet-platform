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

  // Import and use the matrix API's createEventSource to ensure consistency
  createEventSource: (): EventSource => {
    // We'll use the matrixApi.createEventSource method to avoid duplication
    // But since we can't import directly, we need to implement it here again

    // Use the API URL from the app config
    const apiBaseUrl = window.APP_CONFIG?.APP_API_URL || ''

    // Check for overridden API URL (ngrok or other proxy)
    const overrideUrl = window.__MATRIX_API_URL__ || ''

    // Use override if available, otherwise use the configured API URL
    const baseUrl = overrideUrl || apiBaseUrl

    if (!baseUrl) {
      console.error('No API URL found. Make sure APP_API_URL is configured in config.json')
      throw new Error('Cannot connect to Matrix: API URL not configured')
    }

    // Use the same endpoint path as matrix.ts
    const endpoint = `${baseUrl}/api/matrix/events`
    console.log('Chat API creating EventSource connection to:', endpoint)

    return new EventSource(endpoint, { withCredentials: true })
  }
}
