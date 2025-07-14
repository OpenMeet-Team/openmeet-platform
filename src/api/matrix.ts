import { AxiosResponse } from 'axios'
import { api } from '../boot/axios'
import { MatrixMessage } from '../types/matrix'
import matrixTokenService from '../services/matrixTokenService'

export const matrixApi = {
  // Set Matrix password for direct client access
  setPassword: (password: string): Promise<AxiosResponse<{ success: boolean; message: string }>> =>
    api.post('/api/matrix/set-password', { password }),

  // Send typing indicator to a room
  sendTyping: (roomId: string, isTyping: boolean): Promise<AxiosResponse<void>> =>
    api.post(`/api/matrix/${roomId}/typing`, { isTyping }),

  // Get messages for a room with token checking
  getMessages: async (roomId: string, limit = 50, from?: string): Promise<AxiosResponse<{ messages: MatrixMessage[], end: string }>> => {
    try {
      // Ensure we have a valid Matrix token before making the request
      await matrixTokenService.getToken()
      return api.get(`/api/matrix/messages/${roomId}`, { params: { limit, from } })
    } catch (error) {
      console.error('Failed to get Matrix token for messages:', error)
      // Don't retry the same operation - just throw the error for caller to handle
      throw error
    }
  },

  // Send a message to a room with token checking
  sendMessage: async (roomId: string, message: string): Promise<AxiosResponse<{ id: string }>> => {
    try {
      // Ensure we have a valid Matrix token before making the request
      await matrixTokenService.getToken()
      return api.post(`/api/matrix/messages/${roomId}`, { message })
    } catch (error) {
      console.error('Failed to get Matrix token for sending message:', error)
      // Don't retry the same operation - just throw the error for caller to handle
      throw error
    }
  },

  // Get a fresh Matrix token (for direct Matrix operations)
  getToken: async (): Promise<string> => {
    return matrixTokenService.getToken()
  },

  // Sync Matrix user identity with backend after MAS authentication
  syncUserIdentity: (matrixUserId: string): Promise<AxiosResponse<{ success: boolean; matrixUserId: string; handle: string }>> =>
    api.post('/api/matrix/sync-user-identity', { matrixUserId })
}
