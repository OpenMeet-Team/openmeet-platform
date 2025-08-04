import { MatrixMessage } from '../types'
import { matrixApi } from '../api/matrix'
import { logger } from '../utils/logger'

/**
 * Service for handling Matrix API operations
 * WebSocket functionality removed as part of performance optimization
 */
class MatrixServiceImpl {
  // Simple cache for joined room tracking
  private joinedRooms: Set<string> = new Set<string>()

  /**
   * Check if a room is already joined
   * @param roomId The room ID to check
   * @returns true if the room is already joined
   */
  public isRoomJoined (roomId: string): boolean {
    return this.joinedRooms.has(roomId)
  }

  /**
   * Mark a room as joined in the cache
   * @param roomId The room ID to mark as joined
   */
  public markRoomAsJoined (roomId: string): void {
    if (roomId) {
      // Marking room as joined
      this.joinedRooms.add(roomId)
    }
  }

  /**
   * Send a typing indicator to a room
   */
  public async sendTyping (roomId: string, isTyping: boolean): Promise<void> {
    if (!roomId) {
      logger.error('Cannot send typing indicator - no room ID provided')
      return
    }

    try {
      // Sending typing indicator
      await matrixApi.sendTyping(roomId, isTyping)
    } catch (error) {
      logger.error('Error sending typing indicator:', error)
    }
  }

  /**
   * Get messages for a room
   */
  public async getMessages (roomId: string, limit = 50): Promise<{ messages: MatrixMessage[], end: string }> {
    if (!roomId) {
      logger.error('Cannot get messages - no room ID provided')
      return { messages: [], end: '' }
    }

    try {
      const response = await matrixApi.getMessages(roomId, limit)
      return response
    } catch (error) {
      logger.error('Error getting messages:', error)
      return { messages: [], end: '' }
    }
  }

  /**
   * Send a message to a room
   */
  public async sendMessage (roomId: string, message: string): Promise<string | undefined> {
    if (!roomId) {
      logger.error('Cannot send message - no room ID provided')
      return undefined
    }

    if (!message || message.trim() === '') {
      logger.error('Cannot send empty message')
      return undefined
    }

    try {
      const response = await matrixApi.sendMessage(roomId, message)

      if (response && response.id) {
        // Message sent successfully
        return response.id
      } else {
        logger.error('No message ID returned from server')
        return undefined
      }
    } catch (error) {
      logger.error('Error sending message:', error)
      return undefined
    }
  }

  // Legacy compatibility methods (no-op implementations)

  /**
   * @deprecated WebSocket functionality removed for performance optimization
   */
  public async connect (): Promise<boolean> {
    // WebSocket connection removed - using Matrix client for real-time events
    return true
  }

  /**
   * @deprecated WebSocket functionality removed for performance optimization
   */
  public disconnect (): void {
    // WebSocket disconnection no longer needed
    // Clear joined rooms cache for testing compatibility
    this.joinedRooms.clear()
  }

  /**
   * @deprecated WebSocket functionality removed for performance optimization
   */
  public addEventHandler (): void {
    // Event handlers removed with WebSocket functionality
  }

  /**
   * @deprecated WebSocket functionality removed for performance optimization
   */
  public removeEventHandler (): void {
    // Event handlers removed with WebSocket functionality
  }

  /**
   * @deprecated WebSocket functionality removed for performance optimization
   */
  public joinRoom (roomId: string): Promise<boolean> {
    // WebSocket room joining removed - using Matrix client join
    this.markRoomAsJoined(roomId)
    return Promise.resolve(true)
  }
}

// Singleton instance
const matrixServiceInstance = new MatrixServiceImpl()

// Export as a singleton
export const matrixService = matrixServiceInstance
