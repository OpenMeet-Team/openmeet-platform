import { AxiosResponse } from 'axios'
import { api } from '../boot/axios'
import { MatrixMessage } from '../types/matrix'

export const matrixApi = {
  // Send typing indicator to a room
  sendTyping: (roomId: string, isTyping: boolean): Promise<AxiosResponse<void>> =>
    api.post(`/api/matrix/${roomId}/typing`, { isTyping }),

  // Create SSE connection for Matrix events
  createEventSource: (): EventSource =>
    new EventSource('/api/matrix/events', { withCredentials: true }),

  // Get messages for a room
  getMessages: (roomId: string, limit = 50, from?: string): Promise<AxiosResponse<{ messages: MatrixMessage[], end: string }>> =>
    api.get(`/api/matrix/messages/${roomId}`, { params: { limit, from } }),

  // Send a message to a room
  sendMessage: (roomId: string, message: string): Promise<AxiosResponse<{ id: string }>> =>
    api.post(`/api/matrix/messages/${roomId}`, { message })
}
