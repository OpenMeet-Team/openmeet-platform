import { defineStore } from 'pinia'
import { useNotification } from '../composables/useNotification'
import { MatrixMessage } from '../types/matrix'
import { useGroupStore } from './group-store'
import { useEventStore } from './event-store'
import { useAuthStore } from './auth-store'
import { matrixService } from '../services/matrixService'
import { ChatEntity } from '../types/model'
import { chatApi } from '../api/chat'
import { RouteQueryAndHash } from 'vue-router'

const { error } = useNotification()

// Typing indicator debounce time (ms)
const TYPING_DEBOUNCE = 2000

/**
 * Unified Message Store
 *
 * This store handles all types of messaging:
 * - Direct messages between users (previously in chat-store)
 * - Group discussions
 * - Event discussions
 *
 * The API is designed to be consistent across all message types.
 *
 * ----------------------------------------------------------------------------------
 * MIGRATION GUIDE - Using Unified Store for Direct Messages
 * ----------------------------------------------------------------------------------
 *
 * To migrate from chat-store to unified-message-store for direct messaging:
 *
 * 1. Replace imports:
 *    - Before: import { useChatStore } from '@/stores/chat-store'
 *    - After:  import { useMessageStore } from '@/stores/unified-message-store'
 *
 * 2. Function mapping:
 *    - chatStore.actionInitializeMatrix() → messageStore.initializeMatrix()
 *    - chatStore.actionGetChatList() → messageStore.actionGetChatList()
 *    - chatStore.actionSetActiveChat() → messageStore.actionSetActiveChat()
 *    - chatStore.chatList → messageStore.directChats
 *    - chatStore.activeChat → messageStore.activeDirectChat
 *
 * 3. Component updates:
 *    - For MessagesComponent, just set context-type="direct"
 *    - Update references to chat-store getters/actions
 *
 * 4. Sending messages:
 *    - Use messageStore.sendMessage() with any context type
 *    - The store handles routing to the appropriate API based on context
 *
 * This unified store handles all message types with a consistent API, making
 * it easier to maintain and extend messaging functionality across the application.
 */
export const useMessageStore = defineStore('messages', {
  state: () => ({
    // Shared message storage for all contexts
    messages: {} as Record<string, MatrixMessage[]>,

    // Room and context information
    activeRoomId: null as string | null,
    contextType: 'general' as 'general' | 'group' | 'event' | 'direct',
    contextId: '' as string,

    // Direct message support (migrated from chat-store)
    directChats: [] as ChatEntity[], // List of direct message chats
    activeDirectChat: null as ChatEntity | null, // Currently active direct chat

    // Permission controls
    permissions: {
      canRead: false,
      canWrite: false,
      canManage: false
    },

    // UI state flags
    isLoading: false,
    isLoadingChats: false, // For direct chat list loading
    isSending: false,
    isDeleting: false,
    isUpdating: false,

    // Typing indicators
    typingUsers: {} as Record<string, string[]>, // roomId -> array of userIds who are typing
    typingTimer: null as number | null, // Timer for debouncing typing notifications
    isUserTyping: false, // Whether the current user is typing

    // Connection state
    matrixConnected: false, // Whether we're connected to Matrix events
    matrixConnectionAttempted: false, // Whether we've tried to connect to Matrix

    // Deduplication tracking
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

    // Direct messaging getters (migrated from chat-store)

    // Get all direct chats
    allDirectChats: (state) => {
      return state.directChats
    },

    // Get active direct chat
    activeChat: (state) => {
      return state.activeDirectChat
    },

    // Get typing users for the active direct chat
    activeTypingUsers: (state) => {
      if (!state.activeDirectChat || !state.activeDirectChat.roomId) {
        return []
      }
      return state.typingUsers[state.activeDirectChat.roomId] || []
    },

    // Existing context getters
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

      // If this is a direct chat, also update the activeDirectChat
      if (contextType === 'direct') {
        const directChat = this.directChats.find(chat => chat.roomId === roomId)
        if (directChat) {
          this.activeDirectChat = directChat
        }
      }
    },

    // Set permissions
    setPermissions (permissions: { canRead: boolean, canWrite: boolean, canManage: boolean }) {
      this.permissions = permissions
    },

    // Direct messaging actions (migrated from chat-store)

    // Load the list of direct message chats
    async actionGetChatList (query: RouteQueryAndHash = {}) {
      this.isLoadingChats = true

      try {
        console.log('Loading direct message chat list')
        // Since DM endpoints might not be implemented yet, we need to handle 404 errors gracefully
        try {
          const response = await chatApi.getChatList(query)

          // Update the direct chats list
          this.directChats = response.data.chats

          // If there's an active chat returned from the API, update it
          if (response.data.chat) {
            this.activeDirectChat = response.data.chat

            // Also update context to ensure consistent state
            this.setContext(
              response.data.chat.roomId,
              'direct',
              response.data.chat.ulid
            )
          }

          return response.data
        } catch (apiError) {
          if (apiError.response && apiError.response.status === 404) {
            // Endpoint not implemented yet - provide empty data
            console.log('Direct messages API not yet implemented - using empty data')
            this.directChats = []
            return { chats: [], chat: null }
          }
          throw apiError // Re-throw other errors
        }
      } catch (err) {
        console.error('Error loading chat list:', err)
        error('Failed to load chats')
        throw err
      } finally {
        this.isLoadingChats = false
      }
    },

    // Set active direct chat
    actionSetActiveChat (chat: ChatEntity | null) {
      // Update active direct chat
      this.activeDirectChat = chat

      // Also update context to ensure consistent state
      if (chat) {
        this.setContext(chat.roomId, 'direct', chat.ulid)
      } else {
        // If clearing active chat, maintain existing context if not direct
        if (this.contextType === 'direct') {
          this.activeRoomId = null
          this.contextType = 'general'
          this.contextId = ''
        }
      }
    },

    // Mark messages as read
    async actionSetMessagesRead (messageIds: number[]) {
      if (!messageIds.length) return

      try {
        await chatApi.setMessagesRead(messageIds)
      } catch (err) {
        console.error('Error marking messages as read:', err)
      }
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

          // We don't need to register a handler here anymore as matrixService
          // will directly call our addNewMessage method when handling events
          // This prevents duplicate event processing
          console.log('Using centralized event routing through matrixService')
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
    // WARNING: This method should NOT be called directly!
    // This is kept for backward compatibility but will log warnings to identify duplicate event handling.
    // Since message delivery is working correctly now, we'll keep this warning but ensure typing events still work.
    handleMatrixEvent (event: Record<string, unknown>) {
      if (!event || !event.type) return

      try {
        // Only process typing events directly, route everything else through matrixService
        if (event.type === 'm.typing') {
          // We still process typing events directly
          this.updateTypingUsers(
            event.room_id as string,
            event.user_ids as string[]
          )
        } else if (event.type === 'm.room.message') {
          console.warn('!!!WARNING!!! Unified message store directly received Matrix message event - this should now be routed through matrixService')
          // Keep disabled to prevent duplicates: this.addNewMessage(event as unknown as MatrixMessage)
        } else {
          console.warn('!!!WARNING!!! Unified message store directly received Matrix event of type', event.type)
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

      // Debug the message we're processing
      const isTemporaryId = eventId?.startsWith('~') || false
      const isPermanentId = eventId?.startsWith('$') || false
      console.log('!!!DEBUG!!! Processing message in unified-message-store:', {
        eventId,
        roomId,
        idType: isTemporaryId ? 'temporary (~)' : isPermanentId ? 'permanent ($)' : 'unknown',
        broadcastId: message._broadcastId,
        clientMsgId: message.content?._clientMsgId || message._clientMsgId,
        sender: message.sender,
        body: message.content?.body?.substring(0, 20) + (message.content?.body?.length > 20 ? '...' : '')
      })

      // Define tracking key early for use throughout the function
      const trackingKey = `${roomId}:${eventId}`

      // TEMPORARY FIX: Disable stringent duplicate checking while we debug
      // Only check for exact duplicates with the same event ID
      const exactDuplicate = this.messages[roomId]?.some(m =>
        (m.event_id === eventId || m.eventId === eventId)
      )

      if (exactDuplicate) {
        console.log(`!!!DEBUG!!! Found exact duplicate with event ID ${eventId} in room ${roomId}, skipping`)
        return
      }

      // Regular duplicate check
      if (eventId && this.processedBroadcastIds.has(trackingKey)) {
        console.log(`!!!DEBUG!!! Already processed event ID ${eventId} in room ${roomId}, skipping duplicate`)
        return
      }

      // Special handling for Matrix's temporary/permanent ID system
      // If this is a permanent ID (starts with $), look for matching temporary IDs
      if (isPermanentId && this.messages[roomId]) {
        // Find any existing messages with temporary IDs from same sender and same content
        for (let i = 0; i < this.messages[roomId].length; i++) {
          const m = this.messages[roomId][i]
          const mEventId = m.event_id || m.eventId || ''

          if (mEventId.startsWith('~') &&
              m.sender === message.sender &&
              m.content?.body === message.content?.body) {
            console.log(`!!!DEBUG!!! Found matching temp/perm pair - updating ID ${mEventId} to ${eventId}`)

            // Update the existing message with the permanent ID
            this.messages[roomId][i].event_id = eventId

            // Add this permanent ID to our tracking to prevent duplicates
            this.processedBroadcastIds.add(trackingKey)

            // Don't add a new message - this is just updating an existing one
            return
          }
        }
      }

      // Check if we've already processed this broadcast by the broadcast ID
      const broadcastId = message._broadcastId
      if (broadcastId && this.processedBroadcastIds.has(broadcastId)) {
        console.log(`!!!DEBUG!!! Already processed broadcast ID ${broadcastId}, skipping duplicate`)
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

      // Use a very robust check for duplicate messages
      const isDuplicate = this.messages[roomId].some(m => {
        // Check by event ID
        if (m.event_id === eventId || m.eventId === eventId) {
          console.log('!!!DEBUG!!! Exact event ID match found, ignoring duplicate')
          return true
        }

        // Special case for Matrix: Check if one ID starts with ~ and the other with $
        // This handles the case where Matrix first sends a temporary event ID and then the permanent one
        if ((m.event_id?.startsWith('~') && eventId?.startsWith('$')) ||
            (m.event_id?.startsWith('$') && eventId?.startsWith('~'))) {
          // If sender and content match, it's likely the same message with different IDs
          if (m.sender === message.sender && m.content?.body === message.content?.body) {
            console.log('!!!DEBUG!!! Found message with temporary/permanent ID pair, updating ID and treating as duplicate')

            // Update the existing message with the permanent ID (starts with $) if needed
            if (eventId?.startsWith('$') && m.event_id?.startsWith('~')) {
              console.log(`!!!DEBUG!!! Updating event ID from ${m.event_id} to permanent ID ${eventId}`)
              m.event_id = eventId
            }

            return true
          }
        }

        // Check for sender+content+timestamp pattern (to catch duplicate broadcasts)
        if (m.sender === message.sender && m.content?.body === message.content?.body) {
          const mTime = m.origin_server_ts || m.timestamp || 0
          const msgTime = message.origin_server_ts || message.timestamp || 0
          const timeDiff = Math.abs(mTime - msgTime)

          // If same content from same sender within 30 seconds, consider it a duplicate
          if (timeDiff < 30000) {
            console.log('!!!DEBUG!!! Found similar message from same sender with same content within 30 seconds, treating as duplicate')

            // If this message has a permanent ID and the existing one has a temporary ID, update it
            if (eventId?.startsWith('$') && m.event_id?.startsWith('~')) {
              console.log(`!!!DEBUG!!! Updating event ID from ${m.event_id} to permanent ID ${eventId}`)
              m.event_id = eventId
            }

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
      console.log('!!!DEBUG!!! unified-message-store.sendMessage called', {
        message,
        activeRoomId: this.activeRoomId,
        contextType: this.contextType
      })

      if (!this.activeRoomId || !this.permissions.canWrite) {
        console.error('!!!DEBUG!!! Cannot send message: no active room or insufficient permissions', {
          activeRoomId: this.activeRoomId,
          permissions: this.permissions
        })
        throw new Error('Cannot send message: no active room or insufficient permissions')
      }

      this.isSending = true
      try {
        // Clear any typing indicator first
        await this.sendTyping(this.activeRoomId, false)

        // Check if user has Matrix ID
        const authStore = useAuthStore()
        if (!authStore.user?.matrixUserId) {
          console.error('!!!DEBUG!!! Matrix user ID missing', { user: authStore.user })
          throw new Error('Matrix user ID missing. Please refresh the page and try again.')
        }

        console.log('!!!DEBUG!!! User authorized to send message', {
          matrixUserId: authStore.user.matrixUserId,
          room: this.activeRoomId
        })

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
        } else if (this.contextType === 'direct' && this.activeDirectChat) {
          // For direct messages, use the chat API with the slug from activeDirectChat
          console.log('!!!DEBUG!!! Sending direct message through chat API', {
            chatId: this.activeDirectChat.ulid,
            roomId: this.activeDirectChat.roomId
          })
          const result = await chatApi.sendMessage(this.activeDirectChat.ulid, message)
          eventId = result.data.id ? String(result.data.id) : undefined
        } else {
          // General context type or fallback for unknown types
          console.log('!!!DEBUG!!! Sending message through matrixService', {
            roomId: this.activeRoomId
          })
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
      // Update the local state to immediately remove the message from UI
      if (this.activeRoomId) {
        this.messages[this.activeRoomId] = this.messages[this.activeRoomId].filter(m =>
          m.event_id !== eventId && m.eventId !== eventId
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
