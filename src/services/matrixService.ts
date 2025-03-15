import { useAuthStore } from '../stores/auth-store'
import { useChatStore } from '../stores/chat-store'
import { useMessageStore } from '../stores/unified-message-store'
import { ensureMatrixUser } from '../utils/matrixUtils'
import { MatrixMessage } from '../types'
import { matrixApi } from '../api/matrix'
import { api } from '../boot/axios'
import { Socket as SocketIOSocket } from 'socket.io-client'

// Extended Socket type to include our custom properties
interface Socket extends SocketIOSocket {
  tenantId?: string;
}

/**
 * Service for handling Matrix real-time events and sync
 */
class MatrixServiceImpl {
  private socket: Socket | null = null
  public isConnected = false
  private eventHandlers: Set<(event: Record<string, unknown>) => void> = new Set()
  private reconnectTimeout: number | null = null
  private reconnectAttempts = 0
  private readonly MAX_RECONNECT_ATTEMPTS = 5
  private readonly RECONNECT_DELAY = 3000 // 3 seconds
  private tenantId: string = '' // Store tenant ID for use in socket events

  // Ensure we always have a tenant ID available for Matrix operations
  private ensureTenantId (): string {
    if (!this.tenantId) {
      this.tenantId = window.APP_CONFIG?.APP_TENANT_ID ||
                      localStorage.getItem('tenantId') ||
                      'default' // Fallback to default tenant
    }
    return this.tenantId
  }

  /**
   * Connect to the Matrix events endpoint using WebSockets
   */
  public async connect (): Promise<boolean> {
    if (this.socket && this.isConnected) {
      return true
    }

    try {
      // First check if the user is authenticated
      const authStore = useAuthStore()
      if (!authStore.isAuthenticated) {
        console.warn('Cannot connect to Matrix WebSocket: user not authenticated')
        return true // Return true to allow app to continue without real-time
      }

      try {
        // Ensure the user has a Matrix ID provisioned on the server
        // The server will handle all credential management
        const hasMatrix = await ensureMatrixUser()
        if (!hasMatrix) {
          console.warn('Cannot connect to Matrix: failed to provision Matrix user')
          return true // Return true to allow app to continue
        }

        // Verify that the user has a Matrix ID
        // Credentials are now managed server-side
        const user = authStore.user
        if (!user || !user.matrixUserId) {
          console.warn('Cannot connect to Matrix: user missing Matrix ID')
          return true // Return true to allow app to continue
        }

        // Ensure we have tenant ID stored for WebSocket connection
        // This addresses the "Tenant ID is required" error
        this.tenantId = window.APP_CONFIG?.APP_TENANT_ID || localStorage.getItem('tenantId') || ''

        if (!this.tenantId) {
          console.warn('No tenant ID found, using default tenant ID')
          this.tenantId = 'default'

          // Store it everywhere needed
          localStorage.setItem('tenantId', this.tenantId)
          window.APP_CONFIG = window.APP_CONFIG || {}
          window.APP_CONFIG.APP_TENANT_ID = this.tenantId
        }

        console.log('Using tenant ID for Matrix connection:', this.tenantId)
      } catch (error) {
        console.error('Error ensuring Matrix user availability:', error)
        // Continue without Matrix to allow app to function
        return true
      }

      // Close any existing connection
      this.disconnect()

      try {
        console.log('Creating WebSocket connection to Matrix')

        // First, get the WebSocket connection info from the API
        // This ensures we have the correct endpoint and connection parameters
        try {
          const wsInfoResponse = await api.post('/api/matrix/websocket-info')
          const wsInfo = wsInfoResponse.data

          console.log('WebSocket connection info:', wsInfo)

          if (!wsInfo.authenticated) {
            console.warn('User is not authenticated for Matrix WebSocket')
            return false
          }

          // Use the endpoint from the server if provided
          if (wsInfo.endpoint) {
            console.log(`Using server-provided WebSocket endpoint: ${wsInfo.endpoint}`)
            // Set the WebSocket endpoint so the API layer will use it
            // Use the endpoint from the config if available
            const configMatrixUrl = window.APP_CONFIG?.APP_MATRIX_API_URL

            if (configMatrixUrl) {
              window.__MATRIX_API_URL__ = configMatrixUrl
              console.log('Using config Matrix URL:', window.__MATRIX_API_URL__)
            } else {
              // Fall back to the server-provided endpoint with HTTP protocol
              const baseUrl = wsInfo.endpoint.replace(/^wss?:\/\//i, 'https://').replace(/\/matrix$/, '')
              window.__MATRIX_API_URL__ = baseUrl
              console.log('Using server-provided Matrix URL:', window.__MATRIX_API_URL__)
            }
          }
        } catch (wsInfoError) {
          console.error('Failed to get WebSocket connection info:', wsInfoError)
          // Continue anyway, using default connection params
        }

        // Create the socket connection with some debug logging
        console.debug('Creating Socket.IO connection with endpoint information:', {
          wsEndpoint: window.__MATRIX_API_URL__ || 'not set',
          authenticated: true,
          apiBaseUrl: window.APP_CONFIG?.APP_API_URL || 'not set'
        })

        console.log('!!!DEBUG!!! Creating Socket.IO connection for Matrix events')
        this.socket = matrixApi.createSocketConnection()
        console.log('!!!DEBUG!!! Socket.IO connection created:', {
          socketId: this.socket?.id,
          connected: this.socket?.connected
        })
      } catch (e) {
        console.error('Error creating WebSocket connection:', e)
        // Even if there's an error creating the WebSocket, we'll continue without real-time updates
        // This allows the app to function normally even if real-time isn't available
        this.attemptReconnect()
        return true
      }

      return new Promise((resolve) => {
        // Set up event handlers for the socket
        this.socket!.on('connect', () => {
          console.log('Connected to Matrix WebSocket')
          this.isConnected = true
          this.reconnectAttempts = 0

          // Join the user's Matrix rooms with tenant ID
          const authStore = useAuthStore()
          const currentUser = authStore.user

          if (currentUser && currentUser.matrixUserId) {
            // Use our cached tenant ID or ensure we have one
            const tenantId = this.tenantId || this.ensureTenantId()

            console.log('!!!DEBUG!!! Sending join-user-rooms WebSocket event to join all rooms')
            // Include tenant ID in multiple places to ensure the backend sees it
            interface JoinRoomsResponse {
              success: boolean;
              roomCount: number;
              rooms: { id: string; name: string }[];
              error?: string;
            }

            this.socket!.emit('join-user-rooms', {
              userId: currentUser.matrixUserId,
              tenantId
            }, (response: JoinRoomsResponse) => {
              console.log('!!!DEBUG!!! join-user-rooms response:', response)
              if (response && response.roomCount > 0) {
                console.log('!!!DEBUG!!! Successfully joined', response.roomCount, 'Matrix rooms')
                console.log('!!!DEBUG!!! Room IDs:', response.rooms.map(r => r.id).join(', '))
              } else {
                console.warn('!!!DEBUG!!! Failed to join any Matrix rooms or no rooms available')
              }
            })

            // Set the tenant ID as a property on the socket object as well
            this.socket!.tenantId = tenantId

            console.log('!!!DEBUG!!! Joining Matrix rooms for user:', currentUser.matrixUserId, 'with tenant ID:', tenantId)
          } else {
            console.error('!!!DEBUG!!! Cannot join Matrix rooms - user or matrixUserId missing')
          }

          resolve(true)
        })

        this.socket!.on('connect_error', (error) => {
          console.error('Matrix WebSocket connection error:', error)
          this.isConnected = false

          // Check for tenant ID issues specifically
          const errorMsg = error.toString().toLowerCase()
          if (errorMsg.includes('tenant') || errorMsg.includes('authorization')) {
            console.warn('Matrix WebSocket connection error appears to be related to tenant ID or authorization')
            console.log('Current tenant ID information:', {
              socketTenantId: this.socket?.tenantId,
              instanceTenantId: this.tenantId,
              windowAppConfigTenantId: window.APP_CONFIG?.APP_TENANT_ID,
              localStorageTenantId: localStorage.getItem('tenantId')
            })

            // Set to default tenant ID as a last resort
            this.tenantId = 'default'
            localStorage.setItem('tenantId', this.tenantId)
            window.APP_CONFIG = window.APP_CONFIG || {}
            window.APP_CONFIG.APP_TENANT_ID = this.tenantId

            console.log('Set tenant ID to default fallback value:', this.tenantId)
          }

          // We'll keep trying to reconnect a few times
          console.warn('Matrix WebSocket connection error, will attempt to reconnect')

          this.attemptReconnect()
          if (!this.reconnectAttempts) {
            // We still resolve with true to allow the app to function
            resolve(true)
          }
        })

        this.socket!.on('disconnect', (reason) => {
          console.warn('Disconnected from Matrix WebSocket:', reason)
          this.isConnected = false

          if (reason === 'io server disconnect' || reason === 'io client disconnect') {
            // The disconnection was initiated by the server or client, so we won't reconnect
            console.log('Disconnection was intentional, will not reconnect')
          } else {
            // We'll keep trying to reconnect for unintended disconnections
            this.attemptReconnect()
          }
        })

        // Listen for matrix events
        this.socket!.on('matrix-event', (event) => {
          try {
            const eventId = event.event_id || 'unknown'
            const roomId = event.room_id || 'unknown'
            const sender = event.sender || 'unknown'
            const type = event.type || 'unknown'

            console.log('!!!DEBUG!!! Received Matrix event via WebSocket:', {
              eventId,
              roomId,
              sender,
              type,
              timestamp: new Date().toISOString()
            })

            // Add more detailed logging for message events
            if (event.type === 'm.room.message') {
              const isTemporaryId = (eventId?.toString() || '').startsWith('~')
              const isPermanentId = (eventId?.toString() || '').startsWith('$')

              console.log(
                '!!!DEBUG!!! Message event details:',
                {
                  roomId,
                  eventId,
                  idType: isTemporaryId ? 'temporary (~)' : isPermanentId ? 'permanent ($)' : 'unknown',
                  sender,
                  body: event.content?.body?.substring(0, 30) + (event.content?.body?.length > 30 ? '...' : '')
                }
              )

              // For new messages, check if this room is a direct message room
              const chatStore = useChatStore()
              const isDMRoom = chatStore.chatList.some(chat => chat.roomId === roomId)

              console.log(`!!!DEBUG!!! Message will be routed to: ${isDMRoom ? 'chat-store (DM)' : 'unified-message-store (group/event)'}`)
            }

            // Dispatch to handlers
            this.notifyHandlers(event)

            // For testing WebSocket communication without requiring Matrix events
            if (process.env.NODE_ENV === 'development') {
              console.debug(`Matrix event processed: type=${event.type}, roomId=${event.room_id || 'unknown'}`)
            }
          } catch (e) {
            console.error('Error handling Matrix event:', e)
          }
        })
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
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
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
   * Explicitly join a specific Matrix room
   * This ensures the WebSocket connection subscribes to this room's events
   */
  public joinRoom (roomId: string): Promise<boolean> {
    if (!this.socket || !this.isConnected) {
      console.error('!!!DEBUG!!! Cannot join room - not connected to WebSocket')
      return Promise.resolve(false)
    }

    console.log(`!!!DEBUG!!! Explicitly joining room: ${roomId}`)
    return new Promise((resolve) => {
      interface JoinRoomResponse {
        success: boolean;
        error?: string;
      }

      this.socket!.emit('join-room', {
        roomId,
        tenantId: this.tenantId || this.ensureTenantId()
      }, (response: JoinRoomResponse) => {
        if (response?.success) {
          console.log(`!!!DEBUG!!! Successfully joined room: ${roomId}`)
          resolve(true)
        } else {
          console.error(`!!!DEBUG!!! Failed to join room: ${roomId}`, response?.error)
          resolve(false)
        }
      })
    })
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
   *
   * IMPORTANT FIX: The key issue with duplicate messages is that our logic for
   * routing messages between chat-store and unified-message-store isn't reliable.
   * We're currently checking based on activeChat, which doesn't properly identify
   * all DM rooms. We need a more reliable way to determine which store should
   * handle a given message.
   */
  private handleMessageEvent (event: MatrixMessage): void {
    // Support both property naming conventions (room_id and roomId)
    const roomId = event.room_id || event.roomId

    if (!roomId) {
      console.warn('!!!DEBUG!!! Received message event with no roomId:', event)
      return
    }

    // Add a unique broadcast ID to the event if it doesn't already have one
    // This helps with deduplication across handlers
    if (!event._broadcastId) {
      event._broadcastId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    }

    // Determine if this is a permanent or temporary ID for enhanced logging
    const eventId = event.event_id || event.eventId || ''
    const isTemporaryId = eventId?.startsWith('~') || false
    const isPermanentId = eventId?.startsWith('$') || false

    console.log('!!!DEBUG!!! MatrixService: Received message event:', {
      roomId,
      eventId,
      idType: isTemporaryId ? 'temporary (~)' : isPermanentId ? 'permanent ($)' : 'unknown',
      sender: event.sender,
      body: event.content?.body?.substring(0, 20) + (event.content?.body?.length > 20 ? '...' : ''),
      broadcastId: event._broadcastId
    })

    // CRITICAL FIX: Here's the core problem causing duplicate messages...
    // First, we need to reliably determine the message type (DM or group/event room)
    // Add a property to track which store has processed this message
    const chatStore = useChatStore()
    const messageStore = useMessageStore()

    // To reliably identify direct message rooms, check if this room is in the chat list
    // This is much more reliable than checking against activeChat or room prefixes
    const isDMRoom = chatStore.chatList.some(chat => chat.roomId === roomId)

    // Determine which store should handle the message
    if (isDMRoom) {
      // This is a direct message room - only chat store should handle it
      console.log('!!!DEBUG!!! Routing to chat store (direct message room)', {
        eventId,
        roomId,
        chatCount: chatStore.chatList.length,
        activeChat: chatStore.activeChat?.roomId
      })

      try {
        chatStore.actionAddMessage(event)
        console.log('!!!DEBUG!!! Message successfully sent to chat store')
      } catch (e) {
        console.error('!!!ERROR!!! Failed to add message to chat store:', e)
      }
    } else {
      // This is a group/event discussion room - only unified store should handle it
      console.log('!!!DEBUG!!! Routing to unified message store (group/event room)', {
        eventId,
        roomId,
        activeRoom: messageStore.activeRoomId,
        contextType: messageStore.contextType
      })

      try {
        // Ensure topic is set
        if (event.content && !event.content.topic) {
          event.content.topic = 'General'
          console.log('!!!DEBUG!!! Added default General topic to message for unified store')
        }

        messageStore.addNewMessage(event)
        console.log('!!!DEBUG!!! Message successfully sent to unified store')
      } catch (e) {
        console.error('!!!ERROR!!! Failed to add message to unified store:', e)
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
   * Send a typing indicator to a room
   */
  public async sendTyping (roomId: string, isTyping: boolean): Promise<void> {
    if (this.socket && this.isConnected) {
      // Use WebSocket for typing indicators when available
      // Include tenant ID in the event
      const tenantId = this.tenantId || this.ensureTenantId()
      this.socket.emit('typing', {
        roomId,
        isTyping,
        tenantId
      })
    } else {
      // Fall back to REST API if WebSocket is not available
      try {
        await matrixApi.sendTyping(roomId, isTyping)
      } catch (error) {
        console.error('Error sending typing indicator:', error)
        throw error
      }
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
    console.log('!!!DEBUG!!! matrixService.sendMessage called', { roomId, message })

    // Check if this is a direct message room for our routing logic
    const chatStore = useChatStore()
    const isDMRoom = chatStore.chatList.some(chat => chat.roomId === roomId)
    console.log('!!!DEBUG!!! Room type check:', {
      roomId,
      isDMRoom,
      availableRooms: chatStore.chatList.map(c => c.roomId).join(', ')
    })

    if (this.socket && this.isConnected) {
      // Use WebSocket for sending messages when available
      // Include tenant ID in the event
      const tenantId = this.tenantId || this.ensureTenantId()
      console.log('!!!DEBUG!!! Sending message via WebSocket', { roomId, tenantId })

      return new Promise((resolve, reject) => {
        this.socket!.emit('message', {
          roomId,
          message,
          tenantId
        }, (response: { id?: string, error?: string }) => {
          console.log('!!!DEBUG!!! WebSocket message response:', response)

          if (response.error) {
            console.error('!!!DEBUG!!! Error sending message via WebSocket:', response.error)
            reject(new Error(response.error))
          } else if (response.id) {
            console.log('!!!DEBUG!!! Message sent successfully, ID:', response.id)
            resolve(response.id)
          } else {
            console.error('!!!DEBUG!!! Unknown error sending message via WebSocket')
            reject(new Error('Unknown error sending message via WebSocket'))
          }
        })
      })
    } else {
      // Fall back to REST API if WebSocket is not available
      console.log('!!!DEBUG!!! Sending message via REST API (WebSocket not available)')

      try {
        const response = await matrixApi.sendMessage(roomId, message)
        console.log('!!!DEBUG!!! REST API message response:', response.data)
        return response.data.id
      } catch (error) {
        console.error('Error sending message:', error)
        throw error
      }
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
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      console.warn(`Matrix WebSocket connection failed after ${this.MAX_RECONNECT_ATTEMPTS} attempts - continuing without real-time updates`)
      console.info('The app will still function, but real-time updates will not be available')
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
