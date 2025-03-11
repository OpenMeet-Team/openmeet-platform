import { useAuthStore } from '../stores/auth-store'
import { useChatStore } from '../stores/chat-store'
import { useDiscussionStore } from '../stores/discussion-store'
import { ensureMatrixUser } from '../utils/matrixUtils'
import { MatrixMessage } from '../types'

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

    try {
      // First ensure user has Matrix credentials
      const hasMatrix = await ensureMatrixUser()
      if (!hasMatrix) {
        console.error('Cannot connect to Matrix: user lacks Matrix credentials')
        return false
      }

      const user = useAuthStore().user
      if (!user || !user.matrixUserId) {
        console.error('Cannot connect to Matrix: user not authenticated or missing Matrix ID')
        return false
      }

      // Close any existing connection
      this.disconnect()

      const url = '/api/matrix/events'
      this.eventSource = new EventSource(url)

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
          this.attemptReconnect()
          if (!this.reconnectAttempts) {
            resolve(false)
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
    }
  }

  /**
   * Handle Matrix message events
   */
  private handleMessageEvent (event: MatrixMessage): void {
    if (event.room_id) {
      // Check if this is a direct chat message
      const activeChat = useChatStore().activeChat
      if (activeChat && activeChat.roomId && activeChat.roomId === event.room_id) {
        useChatStore().actionAddMessage(event)
      }

      // Check if this is a discussion message
      const contextId = useDiscussionStore().getterContextId
      if (contextId && contextId === event.room_id) {
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
   * Attempt to reconnect to the Matrix events endpoint
   */
  private attemptReconnect (): void {
    if (this.reconnectTimeout) {
      window.clearTimeout(this.reconnectTimeout)
    }

    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      console.error('Max reconnect attempts reached, giving up')
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
