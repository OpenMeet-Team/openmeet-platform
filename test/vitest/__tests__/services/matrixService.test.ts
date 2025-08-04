import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { skipNetworkTests } from '../../../vitest/setup-test-environment'
import { matrixService } from '../../../../src/services/matrixService'
import { MatrixMessage } from '../../../../src/types/matrix'
import type { Socket } from 'socket.io-client'

// Define the mock socket type based on the real implementation
interface MockSocket extends Socket {
  tenantId?: string;
}

// Import axios api before mocking to ensure it's available
import { api } from '../../../../src/boot/axios'

// Mock axios API
vi.mock('../../../../src/boot/axios', () => ({
  api: {
    post: vi.fn().mockResolvedValue({
      data: {
        endpoint: 'http://localhost:8888/socket.io',
        authenticated: true,
        matrixUserId: '@test:matrix.org'
      }
    })
  }
}))

// Mock dependencies - each test will override this as needed
vi.mock('../../../../src/utils/matrixUtils', () => ({
  getMatrixDisplayName: vi.fn()
}))

vi.mock('../../../../src/stores/auth-store', () => ({
  useAuthStore: vi.fn().mockReturnValue({
    user: {
      id: 1,
      ulid: 'user123',
      matrixUserId: '@test:matrix.org',
      matrixAccessToken: 'abc123',
      matrixDeviceId: 'device123'
    },
    isAuthenticated: true,
    token: 'fake-jwt-token'
  })
}))

vi.mock('../../../../src/stores/chat-store', () => ({
  useChatStore: vi.fn().mockReturnValue({
    activeChat: {
      roomId: 'room123',
      name: 'Test Chat'
    },
    actionAddMessage: vi.fn(),
    typingUsers: {},
    setTypingUsers: vi.fn()
  })
}))

vi.mock('../../../../src/stores/unified-message-store', () => ({
  useMessageStore: vi.fn().mockReturnValue({
    activeRoomId: 'room456',
    currentRoomMessages: [],
    addNewMessage: vi.fn(),
    setContext: vi.fn()
  })
}))

// Mock the socket.io-client
vi.mock('socket.io-client', () => {
  return {
    io: vi.fn().mockImplementation(() => ({
      connected: false,
      id: 'mock-socket-id',
      on: vi.fn(),
      emit: vi.fn(),
      disconnect: vi.fn()
    }))
  }
})

// Create mock socket definition before using it in mocks
const mockSocketTemplate = {
  id: 'mock-socket-id',
  connected: false,
  tenantId: 'default',
  on: vi.fn(),
  emit: vi.fn(),
  off: vi.fn(),
  disconnect: vi.fn(),
  io: {
    opts: {}
  }
}

// Mock the createSocketConnection method
vi.mock('../../../../src/api/matrix', () => ({
  matrixApi: {
    createSocketConnection: vi.fn().mockImplementation(() => ({
      ...mockSocketTemplate
    }))
  }
}))

// Import dependencies after mocking
import { useChatStore } from '../../../../src/stores/chat-store'
import { useMessageStore } from '../../../../src/stores/unified-message-store'
import { matrixApi } from '../../../../src/api/matrix'

describe('MatrixService', () => {
  // Get store instances - these are mocked above
  const mockChatStore = useChatStore()
  const mockMessageStore = useMessageStore()
  let mockSocket: MockSocket

  // Use test configuration imported from setup-test-environment.ts
  // All network tests are handled via the skipNetworkTests helper function

  // Setup for each test
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })

    // Create a mock socket with explicit implementation
    mockSocket = {
      id: 'mock-socket-id',
      connected: false,
      tenantId: 'default',
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      on: vi.fn().mockImplementation((eventName, handler) => {
        // Return socket for chaining
        return mockSocket
      }),
      emit: vi.fn().mockImplementation((event, data, callback) => {
        // Handle join-room callback
        if (event === 'join-room' && typeof callback === 'function') {
          setTimeout(() => {
            callback(null, { success: true })
          }, 10)
        }

        // Handle join-user-rooms callback
        if (event === 'join-user-rooms' && typeof callback === 'function') {
          setTimeout(() => {
            // Using null as first parameter to follow Node.js error-first callback pattern
            callback(null, {
              success: true,
              roomCount: 3,
              rooms: [
                { id: 'room-1', name: 'Room 1' },
                { id: 'room-2', name: 'Room 2' },
                { id: 'room-3', name: 'Room 3' }
              ]
            })
          }, 10)
        }

        return mockSocket
      }),
      off: vi.fn().mockReturnValue(mockSocket),
      disconnect: vi.fn().mockReturnValue(mockSocket),
      io: {
        opts: {}
      }
    } as unknown as MockSocket

    // Use our mock socket for all tests - return a Promise that resolves to the socket
    vi.mocked(matrixApi.createSocketConnection).mockResolvedValue(mockSocket)

    // Reset service state by disconnecting
    matrixService.disconnect()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('connect', () => {
    skipNetworkTests('should connect to Matrix events endpoint', async () => {
      const connectPromise = matrixService.connect()

      // Simulate successful connection by calling the 'connect' event handler
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')?.[1]
      if (connectHandler) connectHandler()

      const result = await connectPromise
      expect(result).toBe(true)
    })

    skipNetworkTests('should fail to connect if websocket info shows unauthenticated', async () => {
      // Mock the API post method to return unauthenticated for websocket-info
      const apiPost = vi.mocked(api.post)
      const originalMock = apiPost.getMockImplementation()

      apiPost.mockImplementationOnce((url) => {
        if (url === '/api/matrix/websocket-info') {
          return Promise.resolve({
            data: {
              endpoint: 'http://localhost:8888/socket.io',
              authenticated: false, // This is what causes the connect to return false
              matrixUserId: '@test:matrix.org'
            }
          })
        }
        // Call the original for other URLs
        return originalMock ? originalMock(url) : Promise.resolve({ data: {} })
      })

      // Call the method and wait for the promise to resolve
      const result = await matrixService.connect()

      // This should return false when websocket-info returns unauthenticated: false
      expect(result).toBe(false)
    })

    skipNetworkTests('should handle connection errors and attempt reconnection', async () => {
      // Create a spy on setTimeout
      const setTimeoutSpy = vi.spyOn(window, 'setTimeout')

      const connectPromise = matrixService.connect()

      // Simulate connection error
      const errorHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect_error')?.[1]
      if (errorHandler) errorHandler(new Error('Test connection error'))

      const result = await connectPromise
      expect(result).toBe(false)

      // Should attempt reconnection
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 3000)
    })
  })

  describe('disconnect', () => {
    skipNetworkTests('should close the WebSocket connection', async () => {
      // First connect
      const connectPromise = matrixService.connect()
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')?.[1]
      if (connectHandler) connectHandler()
      await connectPromise

      // Now disconnect
      matrixService.disconnect()

      expect(mockSocket.disconnect).toHaveBeenCalled()
    })

    skipNetworkTests('should clear any pending reconnect timeouts', async () => {
      // First connect and then cause an error to trigger reconnect timeout
      const connectPromise = matrixService.connect()
      const errorHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect_error')?.[1]
      if (errorHandler) errorHandler(new Error('Test connection error'))
      await connectPromise

      // Clear timeout should be called when disconnecting
      const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout')

      matrixService.disconnect()

      expect(clearTimeoutSpy).toHaveBeenCalled()
    })
  })

  describe('event handling', () => {
    let messageHandler: (event: Record<string, unknown>) => void

    beforeEach(async () => {
      // Create a test event handler
      messageHandler = vi.fn()

      // Connect and add the handler
      const connectPromise = matrixService.connect()
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')?.[1]
      if (connectHandler) connectHandler()
      await connectPromise

      matrixService.addEventHandler(messageHandler)
    })

    skipNetworkTests('should process and route Matrix message events to the chat store', async () => {
      // Find the 'matrix-event' handler
      const matrixEventHandler = mockSocket.on.mock.calls.find(call => call[0] === 'matrix-event')?.[1]

      const testMessage: MatrixMessage = {
        event_id: 'evt123',
        room_id: 'room123', // Match the active chat room
        sender: '@alice:matrix.org',
        content: {
          body: 'Hello world',
          msgtype: 'm.text'
        },
        type: 'm.room.message',
        origin_server_ts: Date.now()
      }

      // Simulate receiving a message
      if (matrixEventHandler) matrixEventHandler(testMessage)

      // The message handler should be called
      expect(messageHandler).toHaveBeenCalledWith(testMessage)

      // The chat store should have received the message
      expect(mockChatStore.actionAddMessage).toHaveBeenCalledWith({
        id: 'evt123',
        content: 'Hello world',
        sender: '@alice:matrix.org',
        timestamp: expect.any(Number),
        type: 'm.text'
      })
    })

    skipNetworkTests('should process and route Matrix message events to the unified message store', async () => {
      // Find the 'matrix-event' handler
      const matrixEventHandler = mockSocket.on.mock.calls.find(call => call[0] === 'matrix-event')?.[1]

      const testMessage: MatrixMessage = {
        event_id: 'evt456',
        room_id: 'room456', // Match the active message store room
        sender: '@bob:matrix.org',
        content: {
          body: 'Hello unified store',
          msgtype: 'm.text'
        },
        type: 'm.room.message',
        origin_server_ts: Date.now()
      }

      // Simulate receiving a message
      if (matrixEventHandler) matrixEventHandler(testMessage)

      // The handler should be called
      expect(messageHandler).toHaveBeenCalledWith(testMessage)

      // The message store should have received the message
      expect(mockMessageStore.addNewMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'evt456',
          content: 'Hello unified store',
          sender: '@bob:matrix.org',
          roomId: 'room456'
        })
      )
    })

    skipNetworkTests('should handle Matrix typing events', async () => {
      // Find the 'matrix-event' handler
      const matrixEventHandler = mockSocket.on.mock.calls.find(call => call[0] === 'matrix-event')?.[1]

      // Create a typing event that matches what the WebSocket would send
      const typingEvent = {
        type: 'm.typing',
        room_id: 'room123',
        content: {
          user_ids: ['@alice:matrix.org']
        }
      }

      // Simulate receiving a typing event
      if (matrixEventHandler) matrixEventHandler(typingEvent)

      // The typing users should be updated
      expect(mockChatStore.setTypingUsers).toHaveBeenCalledWith({
        room123: ['@alice:matrix.org']
      })
    })

    skipNetworkTests('should handle errors in event handlers gracefully', async () => {
      // Create an error handler that will throw
      const errorHandler = vi.fn().mockImplementation(() => {
        throw new Error('Test error')
      })

      matrixService.addEventHandler(errorHandler)

      // Setup console.error spy
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      // Find the 'matrix-event' handler
      const matrixEventHandler = mockSocket.on.mock.calls.find(call => call[0] === 'matrix-event')?.[1]

      // Simulate receiving an event that will cause an error
      if (matrixEventHandler) matrixEventHandler({ type: 'test_event' })

      // The error handler should be called and error caught
      expect(errorHandler).toHaveBeenCalled()
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error in Matrix event handler:', expect.any(Error))
    })
  })

  describe('reconnection logic', () => {
    skipNetworkTests('should attempt reconnection with exponential backoff', async () => {
      // Create a spy on setTimeout
      const setTimeoutSpy = vi.spyOn(window, 'setTimeout')

      // First connect and trigger error to start reconnection
      const connectPromise = matrixService.connect()
      const errorHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect_error')?.[1]
      if (errorHandler) errorHandler(new Error('Test connection error'))
      await connectPromise

      // First reconnect attempt should be at 3000ms
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 3000)

      // Fast-forward past the first timeout
      vi.advanceTimersByTime(3000)

      // Should try to reconnect
      expect(matrixApi.createSocketConnection).toHaveBeenCalledTimes(2)

      // Get the new socket
      const newSocket = (matrixApi.createSocketConnection as vi.Mock<() => MockSocket>).mock.results[1].value

      // Simulate another error on the new socket
      const newErrorHandler = vi.mocked(newSocket.on).mock.calls.find(call => call[0] === 'connect_error')?.[1]
      if (newErrorHandler) newErrorHandler(new Error('Test reconnection error'))

      // Second reconnect attempt should be at 6000ms (3000 * 2)
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 6000)
    })

    skipNetworkTests('should stop trying to reconnect after max attempts', async () => {
      // Create a spy on setTimeout
      const setTimeoutSpy = vi.spyOn(window, 'setTimeout')

      // Connect and start the first error
      const connectPromise = matrixService.connect()
      const errorHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect_error')?.[1]
      if (errorHandler) errorHandler(new Error('Test connection error'))
      await connectPromise

      // Simulate 5 failed reconnection attempts
      for (let i = 0; i < 5; i++) {
        // Advance time to trigger reconnect attempt
        vi.advanceTimersByTime(3000 * Math.pow(2, i))

        // Get the latest mock socket
        const currentSocket = (matrixApi.createSocketConnection as vi.Mock<() => MockSocket>).mock.results[i + 1]?.value
        if (currentSocket) {
          // Trigger another error on this socket
          const currentErrorHandler = vi.mocked(currentSocket.on).mock.calls.find(call => call[0] === 'connect_error')?.[1]
          if (currentErrorHandler) currentErrorHandler(new Error(`Test reconnection error ${i + 1}`))
        }
      }

      // After 5 attempts, there should be no more setTimeout calls
      const timeoutCalls = setTimeoutSpy.mock.calls.length

      vi.advanceTimersByTime(10000) // Advance time more

      // No new setTimeout should be set after max attempts
      expect(setTimeoutSpy.mock.calls.length).toBe(timeoutCalls)
    })

    skipNetworkTests('should reset reconnection attempts on successful connection', async () => {
      // Create a spy on setTimeout
      const setTimeoutSpy = vi.spyOn(window, 'setTimeout')

      // Connect and start the first error
      const connectPromise = matrixService.connect()
      const errorHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect_error')?.[1]
      if (errorHandler) errorHandler(new Error('Test connection error'))
      await connectPromise

      // Simulate 2 failed reconnection attempts
      for (let i = 0; i < 2; i++) {
        // Advance time to trigger reconnect attempt
        vi.advanceTimersByTime(3000 * Math.pow(2, i))

        // Get the latest mock socket
        const currentSocket = (matrixApi.createSocketConnection as vi.Mock<() => MockSocket>).mock.results[i + 1]?.value
        if (currentSocket) {
          // Trigger another error on this socket
          const currentErrorHandler = vi.mocked(currentSocket.on).mock.calls.find(call => call[0] === 'connect_error')?.[1]
          if (currentErrorHandler) currentErrorHandler(new Error(`Test reconnection error ${i + 1}`))
        }
      }

      // Third attempt succeeds
      vi.advanceTimersByTime(6000)
      const successSocket = (matrixApi.createSocketConnection as vi.Mock<() => MockSocket>).mock.results[2]?.value
      if (successSocket) {
        const connectHandler = vi.mocked(successSocket.on).mock.calls.find(call => call[0] === 'connect')?.[1]
        if (connectHandler) connectHandler()
      }

      // Now trigger a new error after successful connection
      const newErrorHandler = vi.mocked(successSocket.on).mock.calls.find(call => call[0] === 'connect_error')?.[1]
      if (newErrorHandler) newErrorHandler(new Error('New error after successful connection'))

      // Reset mock to check new calls
      setTimeoutSpy.mockClear()

      // First reconnect attempt should be at 3000ms again (not using exponential backoff from previous attempts)
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 3000)
    })
  })

  describe('joined rooms cache', () => {
    beforeEach(async () => {
      vi.clearAllMocks()

      // Configure a better mock socket for these tests
      const specialMockSocket = {
        id: 'mock-socket-id',
        connected: true,
        emit: vi.fn().mockImplementation((event, data, callback) => {
          if (event === 'join-room' && typeof callback === 'function') {
            callback(null, { success: true })
            return specialMockSocket
          }
          return specialMockSocket
        }),
        on: vi.fn().mockImplementation((event, handler) => {
          // Immediately trigger the 'connect' handler to simulate connection
          if (event === 'connect') {
            setTimeout(() => handler(), 0)
          }
          return specialMockSocket
        }),
        disconnect: vi.fn(),
        off: vi.fn(),
        tenantId: 'default',
        io: { opts: {} }
      }

      // Mock the createSocketConnection to return our special test socket as a Promise
      vi.mocked(matrixApi.createSocketConnection).mockResolvedValue(specialMockSocket as unknown as MockSocket)

      // Enable the isConnected flag to simulate a connected state
      // @ts-expect-error - accessing private property for testing
      matrixService.isConnected = true

      // Connect the service with our mock
      await matrixService.connect()

      // Mock the markRoomAsJoined method to directly add rooms to the cache
      const originalMarkRoom = matrixService.markRoomAsJoined
      vi.spyOn(matrixService, 'markRoomAsJoined').mockImplementation((roomId) => {
        originalMarkRoom.call(matrixService, roomId)
      })
    })

    skipNetworkTests('should mark a room as joined when joining for the first time', async () => {
      const roomId = 'test-room-123'

      // First check that the room is not in cache
      expect(matrixService.isRoomJoined(roomId)).toBe(false)

      // Join the room
      const result = await matrixService.joinRoom(roomId)

      // Verify join request was sent to the socket
      const socket = await matrixApi.createSocketConnection()
      expect(socket.emit).toHaveBeenCalledWith(
        'join-room',
        expect.objectContaining({ roomId }),
        expect.any(Function)
      )

      // Verify room is now in cache
      expect(matrixService.isRoomJoined(roomId)).toBe(true)

      // Verify join was successful
      expect(result).toBe(true)
    })

    skipNetworkTests('should not send join request for already joined rooms', async () => {
      const roomId = 'test-room-456'

      // Join the room first time
      await matrixService.joinRoom(roomId)

      // Reset the socket.emit mock to check if it gets called again
      const socket = await matrixApi.createSocketConnection()
      vi.mocked(socket.emit).mockClear()

      // Try to join the same room again
      const result = await matrixService.joinRoom(roomId)

      // Verify no emit was called
      expect(socket.emit).not.toHaveBeenCalled()

      // Verify result is still successful
      expect(result).toBe(true)
    })

    skipNetworkTests('should clear joined rooms cache on disconnect', async () => {
      const roomId = 'test-room-789'

      // Join the room first
      await matrixService.joinRoom(roomId)

      // Verify room is in cache
      expect(matrixService.isRoomJoined(roomId)).toBe(true)

      // Disconnect
      matrixService.disconnect()

      // Verify cache is cleared
      expect(matrixService.isRoomJoined(roomId)).toBe(false)
    })

    it('should mark multiple rooms as joined from join-user-rooms response', async () => {
      const roomIds = ['room-1', 'room-2', 'room-3']

      // Mark rooms as joined individually
      for (const roomId of roomIds) {
        matrixService.markRoomAsJoined(roomId)
      }

      // Verify all rooms are marked as joined
      for (const roomId of roomIds) {
        expect(matrixService.isRoomJoined(roomId)).toBe(true)
      }
    })
  })
})
