import { AxiosResponse } from 'axios'
import { api } from '../boot/axios'
import { MatrixMessage } from '../types/matrix'
import { matrixClientService } from '../services/matrixClientService'

export const matrixApi = {
  // Set Matrix password for direct client access (existing backend endpoint)
  setPassword: (password: string): Promise<AxiosResponse<{ success: boolean; message: string }>> =>
    api.post('/api/matrix/set-password', { password }),

  // Send typing indicator to a room using Matrix client directly
  sendTyping: async (roomId: string, isTyping: boolean): Promise<void> => {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not authenticated. Please connect to Matrix first.')
    }

    if (isTyping) {
      await client.sendTyping(roomId, true, 30000) // 30 second timeout
    } else {
      await client.sendTyping(roomId, false, 0) // Stop typing
    }
  },

  // Get messages for a room using Matrix client directly
  getMessages: async (roomId: string, limit = 50): Promise<{ messages: MatrixMessage[], end: string }> => {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not authenticated. Please connect to Matrix first.')
    }

    const room = client.getRoom(roomId)
    if (!room) {
      throw new Error(`Room ${roomId} not found or not accessible`)
    }

    // Use Matrix client's scrollback API
    await client.scrollback(room, limit)

    // Convert Matrix events to our MatrixMessage format
    const messages: MatrixMessage[] = room.getLiveTimeline().getEvents()
      .filter(event => event.getType() === 'm.room.message')
      .slice(-limit)
      .map(event => ({
        id: event.getId()!,
        content: event.getContent().body || '',
        sender: event.getSender()!,
        timestamp: event.getTs(),
        type: event.getContent().msgtype || 'm.text'
      }))

    return {
      messages,
      end: ''
    }
  },

  // Send a message to a room using Matrix client directly
  sendMessage: async (roomId: string, message: string): Promise<{ id: string }> => {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not authenticated. Please connect to Matrix first.')
    }

    const result = await client.sendTextMessage(roomId, message)
    return { id: result.event_id }
  },

  // Get Matrix access token (for direct Matrix operations)
  getToken: async (): Promise<string> => {
    const client = matrixClientService.getClient()
    if (!client || !client.getAccessToken()) {
      throw new Error('Matrix client not authenticated. Please connect to Matrix first.')
    }
    return client.getAccessToken()
  },

  // Sync Matrix user identity with backend after MAS authentication (existing backend endpoint)
  syncUserIdentity: (matrixUserId: string): Promise<AxiosResponse<{ success: boolean; matrixUserId: string; handle: string }>> =>
    api.post('/api/matrix/sync-user-identity', { matrixUserId }),

  // Admin endpoint to sync all event attendees to Matrix rooms
  adminSyncAllAttendees: (maxEventsPerTenant?: number): Promise<AxiosResponse<{
    success: boolean;
    message: string;
    results: {
      totalTenants: number;
      totalEvents: number;
      totalUsersAdded: number;
      totalErrors: number;
      startTime: Date;
      endTime: Date;
      duration: number;
      tenants: Array<{
        tenantId: string;
        tenantName: string;
        eventsProcessed: number;
        totalUsersAdded: number;
        totalErrors: number;
        events: Array<{
          eventSlug: string;
          eventName: string;
          attendeesFound: number;
          usersAdded: number;
          errors: string[];
          success: boolean;
        }>;
        errors: string[];
        success: boolean;
      }>;
    };
  }>> => api.post('/api/matrix/admin/sync-all-attendees', { maxEventsPerTenant })
}
