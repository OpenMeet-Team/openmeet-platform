/**
 * Matrix debugging utilities
 * Add these to the browser console to debug live chat issues
 */

import { matrixClientService } from '../services/matrixClientService'

// Add to window for browser console access
declare global {
  interface Window {
    matrixDebug: {
      checkClientState: () => void
      checkRoomState: (roomId: string) => void
      simulateMessage: (roomId: string, message: string) => void
      enableDebugLogs: () => void
      disableDebugLogs: () => void
    }
  }
}

const matrixDebug = {
  /**
   * Check Matrix client state
   */
  checkClientState () {
    const client = matrixClientService.getClient()
    if (!client) {
      console.log('❌ Matrix client not initialized')
      return
    }

    console.log('🔍 Matrix Client State:', {
      isLoggedIn: client.isLoggedIn(),
      userId: client.getUserId(),
      syncState: client.getSyncState(),
      homeserver: client.getHomeserverUrl(),
      roomCount: client.getRooms().length,
      isInitialSyncComplete: client.isInitialSyncComplete()
    })

    // Check if client is ready
    console.log('🔍 Matrix Client Ready:', matrixClientService.isReady())
  },

  /**
   * Check specific room state
   */
  checkRoomState (roomId: string) {
    const client = matrixClientService.getClient()
    if (!client) {
      console.log('❌ Matrix client not initialized')
      return
    }

    const room = client.getRoom(roomId)
    if (!room) {
      console.log('❌ Room not found:', roomId)
      console.log('🔍 Available rooms:', client.getRooms().map(r => r.roomId))
      return
    }

    console.log('🔍 Room State:', {
      roomId: room.roomId,
      name: room.name,
      memberCount: room.getJoinedMembers().length,
      timelineLength: room.timeline.length,
      lastMessage: room.timeline[room.timeline.length - 1]?.getContent()?.body || 'No messages',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      listeners: room.listenerCount('Room.timeline' as any) // Cast to any as Matrix SDK types are complex
    })

    // Check recent timeline events
    const recentEvents = room.timeline.slice(-5).map(event => ({
      id: event.getId(),
      type: event.getType(),
      sender: event.getSender(),
      content: event.getContent(),
      timestamp: new Date(event.getTs()).toLocaleTimeString()
    }))

    console.log('🔍 Recent Timeline Events:', recentEvents)
  },

  /**
   * Simulate sending a message (for testing)
   */
  async simulateMessage (roomId: string, message: string) {
    const client = matrixClientService.getClient()
    if (!client) {
      console.log('❌ Matrix client not initialized')
      return
    }

    try {
      console.log('📤 Sending test message to room:', roomId)
      await client.sendTextMessage(roomId, message)
      console.log('✅ Message sent successfully')
    } catch (error) {
      console.error('❌ Failed to send message:', error)
    }
  },

  /**
   * Enable debug logging
   */
  enableDebugLogs () {
    // Store original console methods
    const originalLog = console.log

    // Override console methods to highlight Matrix logs
    console.log = (...args) => {
      const message = args.join(' ')
      if (message.includes('Matrix') || message.includes('📨') || message.includes('🔄')) {
        originalLog('%c' + message, 'color: #00ff00; font-weight: bold', ...args.slice(1))
      } else {
        originalLog(...args)
      }
    }

    console.log('🔍 Matrix debug logging enabled')
  },

  /**
   * Disable debug logging
   */
  disableDebugLogs () {
    // This would need to restore original console methods
    console.log('🔍 Matrix debug logging disabled')
  }
}

// SECURITY: Do not automatically expose to window
// This should only be exposed by App.vue in secure development environments
// Removed automatic global exposure to prevent production information disclosure

export default matrixDebug
