import { useAuthStore } from '../stores/auth-store'
import { useChatStore } from '../stores/chat-store'
import { useDiscussionStore } from '../stores/discussion-store'
import { ensureMatrixUser } from '../utils/matrixUtils'
import { MatrixMessage } from '../types'
import { matrixApi } from '../api/matrix'

/**
 * Service for handling Matrix real-time events and sync
 */
class MatrixServiceImpl {
  private eventSource: EventSource | null = null
  private isConnected = false
  private eventHandlers: Set<(event: Record<string, unknown>) => void> = new Set()
  private reconnectTimeout: number | null = null
  private reconnectAttempts = 0
  private readonly MAX_RECONNECT_ATTEMPTS = 5
  private readonly RECONNECT_DELAY = 3000 // 3 seconds

  /**
   * Connect to the Matrix events endpoint using Server-Sent Events
   */
  public async connect (): Promise<boolean> {
    if (this.eventSource && this.isConnected) {
      return true
    }

    // Clear any previous disable flag - SSE should be enabled by default
    window.localStorage.removeItem('DISABLE_MATRIX_SSE')
    
    // TODO: In the future, this should be connected to a user preference in the database
    // For now, we'll enable SSE by default

    try {
      // First ensure user has Matrix credentials
      const hasMatrix = await ensureMatrixUser()
      if (!hasMatrix) {
        console.warn('Cannot connect to Matrix: user lacks Matrix credentials')
        return true // Return true to allow app to continue
      }

      const user = useAuthStore().user
      if (!user || !user.matrixUserId) {
        console.warn('Cannot connect to Matrix: user not authenticated or missing Matrix ID')
        return true // Return true to allow app to continue
      }

      // Close any existing connection
      this.disconnect()

      try {
        // Try several possible endpoint paths to find the correct one
        const testEndpoints = [
          '/api/matrix/events',
          '/api/v1/matrix/events',
          '/api/events/matrix'
        ]

        // We used to disable SSE for ngrok URLs, but that's no longer necessary
        // We can use ngrok for SSE as long as the API URL is properly configured

        console.log('Attempting to connect to Matrix events using: ' + testEndpoints[0])
        // Use the matrix API's createEventSource method for the first endpoint
        this.eventSource = matrixApi.createEventSource()
      } catch (e) {
        console.error('Error creating EventSource:', e)
        // Even if there's an error creating the EventSource, we'll continue without real-time updates
        // This allows the app to function normally even if SSE isn't available
        this.attemptReconnect()
        return true
      }

      return new Promise((resolve) => {
        this.eventSource!.onopen = () => {
          console.log('Connected to Matrix events')
          this.isConnected = true
          this.reconnectAttempts = 0
          resolve(true)
        }

        this.eventSource!.onerror = (error) => {
          console.error('Matrix events connection error:', error)
          this.isConnected = false

          // We'll keep trying to reconnect in development mode as well
          console.warn('Matrix SSE connection error, will attempt to reconnect')

          this.attemptReconnect()
          if (!this.reconnectAttempts) {
            // We still resolve with true to allow the app to function
            resolve(true)
          }
        }

        this.eventSource!.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            // Dispatch to handlers
            this.notifyHandlers(data)
          } catch (e) {
            console.error('Error parsing Matrix event:', e)
          }
        }
      })
    } catch (error) {
      console.error('Error connecting to Matrix events:', error)
      return false
    }
  }

  /**
   * Disconnect from the Matrix events endpoint
   */
  public disconnect (): void {
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }
    this.isConnected = false
    if (this.reconnectTimeout) {
      window.clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }
  }

  /**
   * Add an event handler for Matrix events
   */
  public addEventHandler (handler: (event: Record<string, unknown>) => void): void {
    this.eventHandlers.add(handler)
  }

  /**
   * Remove an event handler
   */
  public removeEventHandler (handler: (event: Record<string, unknown>) => void): void {
    this.eventHandlers.delete(handler)
  }

  /**
   * Notify all handlers of an event
   */
  private notifyHandlers (event: Record<string, unknown>): void {
    // Process and route the event to the appropriate store(s)
    this.processMatrixEvent(event)

    // Dispatch a custom event for testing purposes
    if (process.env.NODE_ENV === 'test' || process.env.CYPRESS) {
      window.dispatchEvent(new CustomEvent('matrix-event', { detail: event }))
    }

    for (const handler of this.eventHandlers) {
      try {
        handler(event)
      } catch (e) {
        console.error('Error in Matrix event handler:', e)
      }
    }
  }

  /**
   * Process and route Matrix events to appropriate stores
   */
  private processMatrixEvent (event: Record<string, unknown>): void {
    if (!event.type || typeof event.type !== 'string') {
      return
    }

    console.log('Processing Matrix event:', event.type, event)

    // Different handling based on event type
    switch (event.type) {
      case 'm.room.message':
        this.handleMessageEvent(event as MatrixMessage)
        break
      case 'm.typing':
        this.handleTypingEvent(event)
        break
      case 'm.room.member':
        this.handleMemberEvent(event)
        break
      // Add more event types as needed
      default:
        console.log('Unhandled Matrix event type:', event.type)
    }
  }

  /**
   * Handle Matrix message events
   */
  private handleMessageEvent (event: MatrixMessage): void {
    // Support both property naming conventions (room_id and roomId)
    const roomId = event.room_id || event.roomId

    if (roomId) {
      console.log('Received message event for room:', roomId, event)
      
      // Check if this is a direct chat message
      const activeChat = useChatStore().activeChat
      if (activeChat && activeChat.roomId && activeChat.roomId === roomId) {
        useChatStore().actionAddMessage(event)
      }

      // Check if this is a discussion message
      const contextId = useDiscussionStore().getterContextId
      if (contextId && contextId === roomId) {
        // Need to transform the message to add a topic if not present
        const eventWithTopic = {
          ...event,
          content: {
            ...event.content,
            topic: event.content.topic || 'General'
          }
        }
        useDiscussionStore().messages = [eventWithTopic, ...useDiscussionStore().messages]

        // Make sure the topic exists in the list
        const topicName = event.content.topic as string || 'General'
        if (!useDiscussionStore().topics.some(topic => topic.name === topicName)) {
          useDiscussionStore().topics = [
            { name: topicName },
            ...useDiscussionStore().topics
          ]
        }
      }
      
      // Also notify the unified message store about this message
      // This ensures the message appears in real-time in MessagesComponent
      const { useMessageStore } = require('../stores/unified-message-store')
      const messageStore = useMessageStore()
      messageStore.addNewMessage(event)
    }
  }

  /**
   * Handle Matrix typing events
   */
  private handleTypingEvent (event: Record<string, unknown>): void {
    if (event.room_id && Array.isArray(event.typing)) {
      useChatStore().typingUsers = {
        ...useChatStore().typingUsers,
        [event.room_id as string]: event.typing as string[]
      }
    }
  }

  /**
   * Handle Matrix member events
   */
  private handleMemberEvent (event: Record<string, unknown>): void {
    // Handle member join/leave events if needed
    console.log('Matrix member event:', event)
  }

  /**
   * Send a typing indicator to a room
   */
  public async sendTyping (roomId: string, isTyping: boolean): Promise<void> {
    try {
      await matrixApi.sendTyping(roomId, isTyping)
    } catch (error) {
      console.error('Error sending typing indicator:', error)
      throw error
    }
  }

  /**
   * Get messages for a room
   */
  public async getMessages (roomId: string, limit = 50, from?: string): Promise<{ messages: MatrixMessage[], end: string }> {
    try {
      const response = await matrixApi.getMessages(roomId, limit, from)
      return response.data
    } catch (error) {
      console.error('Error getting messages:', error)
      return { messages: [], end: '' }
    }
  }

  /**
   * Send a message to a room
   */
  public async sendMessage (roomId: string, message: string): Promise<string | undefined> {
    try {
      const response = await matrixApi.sendMessage(roomId, message)
      return response.data.id
    } catch (error) {
      console.error('Error sending message:', error)
      throw error
    }
  }

  /**
   * Attempt to reconnect to the Matrix events endpoint
   */
  private attemptReconnect (): void {
    if (this.reconnectTimeout) {
      window.clearTimeout(this.reconnectTimeout)
    }

    // For now, only attempt 5 reconnections to avoid too many connection attempts
    if (this.reconnectAttempts >= 5) {
      console.warn('Matrix SSE connection failed after 5 attempts - continuing without real-time updates')
      console.info('The app will still function, but real-time updates will not be available')
      // Do NOT set the DISABLE_MATRIX_SSE flag since it would affect future page loads
      return
    }

    this.reconnectAttempts++
    const delay = this.RECONNECT_DELAY * Math.pow(1.5, this.reconnectAttempts - 1)
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`)

    this.reconnectTimeout = window.setTimeout(() => {
      console.log('Reconnecting to Matrix events...')
      this.connect().catch(error => {
        console.error('Error reconnecting to Matrix events:', error)
      })
    }, delay)
  }
}

// Singleton instance
const matrixServiceInstance = new MatrixServiceImpl()

// Export as a singleton
export const matrixService = matrixServiceInstance
