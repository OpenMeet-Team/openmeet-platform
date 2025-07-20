import { AxiosResponse } from 'axios'
import { api } from '../boot/axios'
import { ChatEntity } from '../types'
import { MatrixMessage } from '../types/matrix'
import { RouteQueryAndHash } from 'vue-router'
import { Socket as SocketIOClient } from 'socket.io-client'

// Define a Socket type that's compatible with what matrixApi returns
type Socket = SocketIOClient

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

  // Matrix-native approach: joinEventChatRoom removed
  // Room joining is now handled directly via Matrix JS SDK using room aliases

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

  // Matrix-native approach: joinGroupChatRoom removed
  // Room joining is now handled directly via Matrix JS SDK using room aliases

  addMemberToGroupDiscussion: (groupSlug: string, userSlug: string): Promise<AxiosResponse<{
    success?: boolean;
    roomId?: string;
    message?: string;
  }>> =>
    api.post(`/api/chat/group/${groupSlug}/members/${userSlug}`),

  removeMemberFromGroupDiscussion: (groupSlug: string, userSlug: string): Promise<AxiosResponse<void>> =>
    api.delete(`/api/chat/group/${groupSlug}/members/${userSlug}`),

  // Matrix-native approach: Room ensure endpoints removed
  // Rooms are now created on-demand via Matrix Application Service using room aliases
  // No need for explicit room creation/ensure endpoints

  // Mark messages as read
  setMessagesRead: (messageIds: number[]) =>
    api.post('/api/chat/messages/read', { messages: messageIds }),

  // Send typing indicator
  sendTyping: (roomId: string, isTyping: boolean): Promise<AxiosResponse<void>> =>
    api.post(`/api/matrix/${roomId}/typing`, { isTyping }),

  // @deprecated WebSocket functionality removed for performance optimization
  createSocketConnection: async (): Promise<Socket> => {
    throw new Error('WebSocket functionality removed - use Matrix client for real-time events')
  },

  // Legacy method for backward compatibility - throws error to identify usage
  createEventSource: (): EventSource => {
    console.error('EventSource is no longer supported - please update your code to use WebSocket')
    throw new Error('EventSource is deprecated in favor of WebSockets for chat events')
  },

  // Matrix room permission management (admin endpoints)
  listRoomsWithPermissionIssues: (): Promise<AxiosResponse<{
    success: boolean;
    roomsWithIssues: Array<{
      roomType: 'event' | 'group';
      slug: string;
      roomId: string;
      botCurrentPowerLevel: number;
      botExpectedPowerLevel: number;
      canBeFixed: boolean;
      issues: string[];
    }>;
    summary: {
      totalRooms: number;
      roomsWithIssues: number;
      fixableRooms: number;
    };
    message?: string;
  }>> =>
    api.get('/api/chat/admin/rooms/permission-issues'),

  fixRoomPermissions: (roomIds: string[]): Promise<AxiosResponse<{
    success: boolean;
    results: Array<{
      roomId: string;
      fixed: boolean;
      newPowerLevel: number;
      error?: string;
    }>;
    summary: {
      totalAttempted: number;
      successfulFixes: number;
      failedFixes: number;
    };
    message?: string;
  }>> =>
    api.post('/api/chat/admin/rooms/fix-permissions', { roomIds })
}
