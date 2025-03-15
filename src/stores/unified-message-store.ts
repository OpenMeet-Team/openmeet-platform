import { defineStore } from 'pinia'
import { useNotification } from '../composables/useNotification'
import { MatrixMessage } from '../types/matrix'
import { useGroupStore } from './group-store'
import { useEventStore } from './event-store'
import { useAuthStore } from './auth-store'
import { matrixService } from '../services/matrixService'

const { error } = useNotification()

// Typing indicator debounce time (ms)
const TYPING_DEBOUNCE = 2000

export const useMessageStore = defineStore('messages', {
  state: () => ({
    messages: {} as Record<string, MatrixMessage[]>,
    activeRoomId: null as string | null,
    contextType: 'general' as 'general' | 'group' | 'event' | 'direct',
    contextId: '' as string,
    permissions: {
      canRead: false,
      canWrite: false,
      canManage: false
    },
    isLoading: false,
    isSending: false,
    isDeleting: false,
    isUpdating: false,
    typingUsers: {} as Record<string, string[]>, // roomId -> array of userIds who are typing
    typingTimer: null as number | null, // Timer for debouncing typing notifications
    isUserTyping: false, // Whether the current user is typing
    matrixConnected: false, // Whether we're connected to Matrix events
    matrixConnectionAttempted: false, // Whether we've tried to connect to Matrix
    processedBroadcastIds: new Set<string>() // Track broadcast IDs we've already processed
  }),

  getters: {
    // Get messages for active room
    currentRoomMessages: (state) => {
      if (!state.activeRoomId) {
        console.log('!!!DEBUG!!! currentRoomMessages getter: No active room ID set')
        return []
      }

      console.log(`!!!DEBUG!!! currentRoomMessages getter: Getting messages for room ${state.activeRoomId}`)
      console.log(`!!!DEBUG!!! Available room IDs: ${Object.keys(state.messages).join(', ')}`)

      const messages = state.messages[state.activeRoomId] || []
      console.log(`!!!DEBUG!!! Found ${messages.length} messages for room ${state.activeRoomId}`)

      return messages
    },

    // Get typing users for the active room
    typingUsersInCurrentRoom: (state) => {
      if (!state.activeRoomId) return []
      return state.typingUsers[state.activeRoomId] || []
    },

    getterPermissions: (state) => state.permissions,
    getterContextId: (state) => state.contextId,
    getterContextType: (state) => state.contextType
  },

  actions: {
    // Set context information
    setContext (roomId: string, contextType: 'general' | 'group' | 'event' | 'direct', contextId: string) {
      this.activeRoomId = roomId
      this.contextType = contextType
      this.contextId = contextId

      // Initialize messages array for this room if it doesn't exist
      if (!this.messages[roomId]) {
        this.messages[roomId] = []
      }
    },

    // Set permissions
    setPermissions (permissions: { canRead: boolean, canWrite: boolean, canManage: boolean }) {
      this.permissions = permissions
    },

    // Initialize Matrix connection
    async initializeMatrix () {
      // Don't try to connect again if we've already attempted
      if (this.matrixConnectionAttempted) return this.matrixConnected

      this.matrixConnectionAttempted = true

      try {
        console.log('Initializing Matrix connection for real-time updates')

        // Connect to Matrix events service
        const success = await matrixService.connect()
        this.matrixConnected = success

        if (success) {
          console.log('Successfully connected to Matrix events')

          // Add event handler for Matrix events
          matrixService.addEventHandler(this.handleMatrixEvent.bind(this))

          // Log that we're ready to receive events
          console.log('Event handler registered, ready to receive real-time updates')
        } else {
          console.error('Failed to connect to Matrix events')
        }

        return success
      } catch (err) {
        console.error('Error initializing Matrix connection:', err)
        return false
      }
    },

    // Handle Matrix events from SSE
    handleMatrixEvent (event: Record<string, unknown>) {
      if (!event || !event.type) return

      try {
        console.log('Unified message store received Matrix event:', event)

        // Handle different event types
        if (event.type === 'm.typing') {
          this.updateTypingUsers(
            event.room_id as string,
            event.user_ids as string[]
          )
        } else if (event.type === 'm.room.message') {
          console.log('Processing incoming message event in unified store')
          this.addNewMessage(event as unknown as MatrixMessage)
        }
      } catch (err) {
        console.error('Error handling Matrix event:', err)
      }
    },

    // Update typing users for a room
    updateTypingUsers (roomId: string, userIds: string[]) {
      if (!roomId || !Array.isArray(userIds)) return
      this.typingUsers[roomId] = userIds
    },

    // Add a new message from real-time events
    addNewMessage (message: MatrixMessage) {
      // Support both property naming conventions
      const roomId = message.room_id || message.roomId
      const eventId = message.event_id || message.eventId

      if (!message || !roomId || !eventId) {
        console.warn('Received invalid message:', message)
        return
      }

      // Check if we've already processed this broadcast by the broadcast ID
      const broadcastId = message._broadcastId
      if (broadcastId && this.processedBroadcastIds.has(broadcastId)) {
        console.log(`!!!DEBUG!!! Already processed broadcast ID ${broadcastId}, skipping duplicate`)
        return
      }

      // Also track by event ID - necessary because the same event might come through multiple matrix sync responses
      // and not all may have the same broadcastId
      const trackingKey = `${roomId}:${eventId}`
      if (eventId && this.processedBroadcastIds.has(trackingKey)) {
        console.log(`!!!DEBUG!!! Already processed event ID ${eventId} in room ${roomId}, skipping duplicate`)
        return
      }

      // Also check for messages with a client message ID (used by optimistic messages)
      const clientMsgId = message.content?._clientMsgId || message._clientMsgId
      if (clientMsgId) {
        const clientKey = `${roomId}:${clientMsgId}`
        if (this.processedBroadcastIds.has(clientKey)) {
          console.log(`!!!DEBUG!!! Already processed client message ID ${clientMsgId}, skipping duplicate`)
          return
        }
      }

      // Initialize room messages if needed
      if (!this.messages[roomId]) {
        this.messages[roomId] = []
        console.log(`!!!DEBUG!!! Initialized empty message array for room ${roomId}`)
      }

      // Add the message to the messages array if it doesn't already exist
      // Use a very robust check for duplicate messages
      const isDuplicate = this.messages[roomId].some(m => {
        // Check by event ID
        if (m.event_id === eventId || m.eventId === eventId) {
          console.log('!!!DEBUG!!! Exact event ID match found, ignoring duplicate')
          return true
        }

        // Check for sender+content+timestamp pattern (to catch duplicate broadcasts)
        if (m.sender === message.sender && m.content?.body === message.content?.body) {
          const mTime = m.origin_server_ts || m.timestamp || 0
          const msgTime = message.origin_server_ts || message.timestamp || 0
          const timeDiff = Math.abs(mTime - msgTime)

          // If same content from same sender within 30 seconds, consider it a duplicate
          if (timeDiff < 30000) {
            console.log('!!!DEBUG!!! Found similar message from same sender with same content within 30 seconds, treating as duplicate')
            return true
          }
        }

        // Also check for different senders but identical content in very close time proximity
        // This might be the case for test broadcasts that get attributed to different users
        if (m.content?.body === message.content?.body) {
          const mTime = m.origin_server_ts || m.timestamp || 0
          const msgTime = message.origin_server_ts || message.timestamp || 0
          const timeDiff = Math.abs(mTime - msgTime)

          // If exactly same content within 5 seconds even from different users, might be a duplicate broadcast
          if (timeDiff < 5000) {
            console.log('!!!DEBUG!!! Messages with identical content from different senders arrived within 5 seconds, likely duplicate broadcast, ignoring')
            return true
          }
        }

        return false
      })

      // If it's a duplicate, return early before adding to the processed sets
      if (isDuplicate) {
        console.log(`!!!DEBUG!!! Message ${eventId} already exists in room ${roomId} or is a duplicate`)
        return
      }

      // Since we confirmed it's not a duplicate, now add to processed sets
      if (broadcastId) {
        this.processedBroadcastIds.add(broadcastId)
        // Clean up old broadcast IDs after 30 seconds to avoid memory leaks
        setTimeout(() => {
          this.processedBroadcastIds.delete(broadcastId)
        }, 30000)
      }

      if (eventId) {
        this.processedBroadcastIds.add(trackingKey)
        // Clean up old event IDs after 30 seconds to avoid memory leaks
        setTimeout(() => {
          this.processedBroadcastIds.delete(trackingKey)
        }, 30000)
      }

      // Simple logging for test messages
      if (eventId.toString().startsWith('test-')) {
        console.log(`!!!DEBUG!!! Received test message ${eventId} for room ${roomId}`)
      }

      console.log(`!!!DEBUG!!! Adding message ${eventId} to room ${roomId}`)

      // Add topic if not present (critical for message grouping)
      if (message.content && !message.content.topic) {
        message.content.topic = 'General'
        console.log('!!!DEBUG!!! Added default General topic to message')
      }

      this.messages[roomId].push(message)
      console.log(`!!!DEBUG!!! Room ${roomId} now has ${this.messages[roomId].length} messages`)

      // Sort messages by timestamp (supporting both naming conventions)
      this.messages[roomId].sort((a, b) => {
        const aTime = a.origin_server_ts || a.timestamp || 0
        const bTime = b.origin_server_ts || b.timestamp || 0
        return aTime - bTime
      })

      // Force reactivity update if this is the active room
      if (this.activeRoomId === roomId) {
        console.log('!!!DEBUG!!! Triggering reactive update for active room')
        // Trigger a reactive update by creating a new array
        this.messages = { ...this.messages }
      } else {
        console.log(`!!!DEBUG!!! Not triggering update because active room (${this.activeRoomId}) != message room (${roomId})`)
      }
    },

    // Send typing indicator status
    async sendTyping (roomId: string, isTyping: boolean) {
      try {
        // Don't send duplicate typing notifications
        if (this.isUserTyping === isTyping) return

        // Update state
        this.isUserTyping = isTyping

        // Send typing status to server
        await matrixService.sendTyping(roomId, isTyping)

        // Clear any existing timer
        if (this.typingTimer) {
          window.clearTimeout(this.typingTimer)
          this.typingTimer = null
        }

        // If typing, set a timer to automatically clear typing status
        if (isTyping) {
          this.typingTimer = window.setTimeout(() => {
            this.sendTyping(roomId, false).catch(console.error)
          }, TYPING_DEBOUNCE)
        }
      } catch (err) {
        console.error('Failed to send typing indicator:', err)
      }
    },

    // Load messages for a room
    async loadMessages (limit = 50, from?: string) {
      if (!this.activeRoomId) return { messages: [], end: '' }

      this.isLoading = true
      try {
        let result: { messages: MatrixMessage[], end: string }

        // Special handling for constructed roomIds (temporary room IDs constructed from event_id)
        if (this.activeRoomId.startsWith('constructed:')) {
          // This is a fallback room ID that we constructed because the API didn't provide one
          // Extract the event_id and use that to help identify the room on the backend
          const eventId = this.activeRoomId.replace('constructed:', '')
          console.log('Using constructed room ID with event ID:', eventId)

          // For now, we just log this scenario, but in the future, we could
          // make a special API call to the backend to resolve the actual room ID
        }

        // Use different API methods based on context type
        if (this.contextType === 'event') {
          result = await useEventStore().actionGetEventDiscussionMessages(limit, from)
        } else if (this.contextType === 'group') {
          result = await useGroupStore().actionGetGroupDiscussionMessages(limit, from)
        } else {
          // Direct messages or other types
          result = await matrixService.getMessages(this.activeRoomId, limit, from)
        }

        // Process and store messages
        if (result && result.messages) {
          if (from) {
            // Append new messages (pagination)
            this.messages[this.activeRoomId] = [...this.messages[this.activeRoomId], ...result.messages]
          } else {
            // Initial load
            this.messages[this.activeRoomId] = result.messages
          }

          // Sort messages by timestamp (supporting both naming conventions)
          this.messages[this.activeRoomId].sort((a, b) => {
            const aTime = a.origin_server_ts || a.timestamp || 0
            const bTime = b.origin_server_ts || b.timestamp || 0
            return aTime - bTime
          })
        }

        return result
      } catch (err) {
        console.error('Error loading messages:', err)
        return { messages: [], end: '' }
      } finally {
        this.isLoading = false
      }
    },

    // Send a message
    async sendMessage (message: string) {
      if (!this.activeRoomId || !this.permissions.canWrite) {
        throw new Error('Cannot send message: no active room or insufficient permissions')
      }

      this.isSending = true
      try {
        // Clear any typing indicator first
        await this.sendTyping(this.activeRoomId, false)

        // Check if user has Matrix ID
        if (!useAuthStore().user?.matrixUserId) {
          throw new Error('Matrix user ID missing. Please refresh the page and try again.')
        }

        // Check if we already have a message with this content from this user in the last 2 seconds
        // This would indicate that the message has already come through via Matrix WebSocket
        const recentTime = Date.now() - 2000
        const existingMessage = this.activeRoomId && this.messages[this.activeRoomId]?.find(m => {
          return (
            m.sender === useAuthStore().user?.matrixUserId &&
            m.content?.body === message &&
            (m.origin_server_ts || m.timestamp || 0) > recentTime
          )
        })

        if (existingMessage) {
          console.log('!!!DEBUG!!! Message already exists in room, skipping optimistic update', message)
          // Return the existing event ID
          return existingMessage.event_id || existingMessage.eventId
        }

        let eventId: string | undefined

        // Use different methods based on context type
        if (this.contextType === 'group') {
          const result = await useGroupStore().actionSendGroupDiscussionMessage(message)
          eventId = result ? String(result) : undefined
        } else if (this.contextType === 'event') {
          const result = await useEventStore().actionSendEventDiscussionMessage(message)
          eventId = result ? String(result) : undefined
        } else {
          // Direct messages or other types
          const result = await matrixService.sendMessage(this.activeRoomId, message)
          eventId = result ? String(result) : undefined
        }

        if (eventId) {
          // After getting eventId, check again if the message has already been added via WebSocket
          // This prevents adding optimistic messages after matrix events have been received
          const updatedRecentTime = Date.now() - 2000
          const updatedExistingMessage = this.activeRoomId && this.messages[this.activeRoomId]?.find(m => {
            return (
              (m.event_id === eventId || m.eventId === eventId) ||
              (m.sender === useAuthStore().user?.matrixUserId &&
               m.content?.body === message &&
               (m.origin_server_ts || m.timestamp || 0) > updatedRecentTime)
            )
          })

          if (updatedExistingMessage) {
            console.log('!!!DEBUG!!! Message has been received via WebSocket while waiting for API response, skipping optimistic message')
            return eventId
          }

          // Create optimistic message
          const currentUser = useAuthStore().user
          const displayName = currentUser
            ? [currentUser.firstName, currentUser.lastName].filter(Boolean).join(' ') || currentUser.email?.split('@')[0] || 'OpenMeet User'
            : 'OpenMeet User'

          // Generate a client-specific ID for deduplication
          const clientMsgId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`

          const newMessage: MatrixMessage = {
            event_id: eventId,
            room_id: this.activeRoomId,
            sender: useAuthStore().user?.matrixUserId,
            sender_name: displayName, // Add OpenMeet username
            content: {
              msgtype: 'm.text',
              body: message,
              // Add a special field to mark this as an optimistic message and track it
              _clientMsgId: clientMsgId
            },
            origin_server_ts: Date.now(),
            type: 'm.room.message',
            _optimistic: true,
            _clientMsgId: clientMsgId
          }

          // Track this message in our deduplication system
          const trackingKey = `${this.activeRoomId}:${clientMsgId}`
          this.processedBroadcastIds.add(trackingKey)

          // Also track by event ID to ensure we don't get duplicates when the real message arrives
          const eventTrackingKey = `${this.activeRoomId}:${eventId}`
          this.processedBroadcastIds.add(eventTrackingKey)

          // Clean up tracking after 30 seconds to avoid memory leaks
          setTimeout(() => {
            this.processedBroadcastIds.delete(trackingKey)
            this.processedBroadcastIds.delete(eventTrackingKey)
          }, 30000)

          // Add to message list
          if (!this.messages[this.activeRoomId]) {
            this.messages[this.activeRoomId] = []
          }
          this.messages[this.activeRoomId].push(newMessage)

          // Sort messages by timestamp (supporting both naming conventions)
          this.messages[this.activeRoomId].sort((a, b) => {
            const aTime = a.origin_server_ts || a.timestamp || 0
            const bTime = b.origin_server_ts || b.timestamp || 0
            return aTime - bTime
          })

          console.log(`!!!DEBUG!!! Added optimistic message with client ID ${clientMsgId} and event ID ${eventId}`)
        }

        return eventId
      } catch (err) {
        console.error('Error sending message:', err)
        error('Failed to send message')
        throw err
      } finally {
        this.isSending = false
      }
    },

    // Update a message
    async updateMessage (eventId: string, newText: string) {
      // Matrix doesn't fully support message editing through our API yet
      this.isUpdating = false

      // Update the local state for now
      if (this.activeRoomId) {
        this.messages[this.activeRoomId] = this.messages[this.activeRoomId].map(m =>
          m.event_id === eventId ? {
            ...m,
            content: {
              ...m.content,
              body: newText
            }
          } : m
        )
      }

      return eventId
    },

    // Delete a message
    async deleteMessage (eventId: string) {
      // Matrix doesn't fully support message deletion through our API yet
      this.isDeleting = false

      // Update the local state for now
      if (this.activeRoomId) {
        this.messages[this.activeRoomId] = this.messages[this.activeRoomId].filter(m =>
          m.event_id !== eventId
        )
      }

      return eventId
    },

    // Cleanup when component unmounts
    cleanup () {
      // Clear any typing timer
      if (this.typingTimer) {
        window.clearTimeout(this.typingTimer)
        this.typingTimer = null
      }

      // Reset typing state
      this.isUserTyping = false

      // Don't disconnect from Matrix as it might be used by other components
    }
  }
})
