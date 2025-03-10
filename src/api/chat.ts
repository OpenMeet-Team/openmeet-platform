import { AxiosResponse } from 'axios'
import { api } from '../boot/axios'
import { ChatEntity, MatrixMessage, MatrixRoom } from '../types'
import { RouteQueryAndHash } from 'vue-router'

export const chatApi = {
  // Get list of chat rooms for the current user
  getChatList: (query: RouteQueryAndHash = {}): Promise<AxiosResponse<{ chats: ChatEntity[]; chat: ChatEntity | null }>> =>
    api.get('/api/chat', { params: query }),

  // Send a message to a specific room
  sendMessage: (roomId: string, message: string): Promise<AxiosResponse<{ eventId: string }>> =>
    api.post(`/api/chat/${roomId}/message`, { content: message }),

  // Mark messages as read
  setMessagesRead: (roomId: string, eventId: string): Promise<AxiosResponse<void>> =>
    api.post('/api/chat/messages/read', { roomId, eventId }),

  // Get messages from a room
  getMessages: (roomId: string, limit: number = 50, from?: string): Promise<AxiosResponse<{
    chunk: MatrixMessage[];
    start: string;
    end: string;
  }>> => api.get(`/api/chat/${roomId}/messages`, { params: { limit, from } }),

  // Update a message
  updateMessage: (roomId: string, eventId: string, content: string): Promise<AxiosResponse<{ eventId: string }>> =>
    api.put(`/api/chat/${roomId}/messages/${eventId}`, { content }),

  // Delete a message
  deleteMessage: (roomId: string, eventId: string): Promise<AxiosResponse<{ eventId: string }>> =>
    api.delete(`/api/chat/${roomId}/messages/${eventId}`),

  // Create a new room
  createRoom: (name: string, topic?: string, isPublic?: boolean): Promise<AxiosResponse<{ roomId: string }>> =>
    api.post('/api/chat/rooms', { name, topic, isPublic }),

  // Invite a user to a room
  inviteToRoom: (roomId: string, userId: string): Promise<AxiosResponse<void>> =>
    api.post(`/api/chat/${roomId}/invite`, { userId }),

  // Remove a user from a room
  kickFromRoom: (roomId: string, userId: string, reason?: string): Promise<AxiosResponse<void>> =>
    api.post(`/api/chat/${roomId}/kick`, { userId, reason }),

  // Get rooms for the current user
  getUserRooms: (): Promise<AxiosResponse<MatrixRoom[]>> =>
    api.get('/api/chat/rooms')
}
