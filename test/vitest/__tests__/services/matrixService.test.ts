import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest'
import { matrixService } from '../../../../src/services/matrixService'
import { ensureMatrixUser } from '../../../../src/utils/matrixUtils'
import { MatrixMessage, MatrixTypingIndicator } from '../../../../src/types/matrix'

// Mock dependencies
vi.mock('../../../../src/utils/matrixUtils', () => ({
  ensureMatrixUser: vi.fn().mockResolvedValue(true)
}))

vi.mock('../../../../src/stores/auth-store', () => ({
  useAuthStore: vi.fn().mockReturnValue({
    user: {
      id: 1,
      ulid: 'user123',
      matrixUserId: '@test:matrix.org',
      matrixAccessToken: 'abc123',
      matrixDeviceId: 'device123'
    }
  })
}))

vi.mock('../../../../src/stores/chat-store', () => ({
  useChatStore: vi.fn().mockReturnValue({
    activeChat: {
      roomId: 'room123',
      name: 'Test Chat'
    },
    actionAddMessage: vi.fn(),
    typingUsers: {}
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

// Create EventSource mock
// This is a simplified mock that doesn't fully implement the EventSource interface
class MockEventSource {
  url: string
  withCredentials: boolean = false
  readyState: number = 0

  // Instance versions of constants
  readonly CONNECTING = 0 as const
  readonly OPEN = 1 as const
  readonly CLOSED = 2 as const

  // Static constants for compatibility
  static readonly CONNECTING = 0 as const
  static readonly OPEN = 1 as const
  static readonly CLOSED = 2 as const

  // Event handlers that we'll call in our simulate methods
  onopen: ((ev: Event) => void) | null = null
  onmessage: ((ev: MessageEvent) => void) | null = null
  onerror: ((ev: Event) => void) | null = null

  constructor (url: string) {
    this.url = url
  }

  // Add methods to simulate events for testing
  simulateOpen () {
    if (this.onopen) {
      const event = new Event('open')
      this.onopen(event)
    }
  }

  simulateMessage (data: unknown) {
    if (this.onmessage) {
      // Create a minimal message event with the required properties
      const event = new MessageEvent('message', {
        data: JSON.stringify(data),
        lastEventId: '',
        origin: 'http://localhost'
      })

      this.onmessage(event)
    }
  }

  simulateError () {
    if (this.onerror) {
      const event = new Event('error')
      this.onerror(event)
    }
  }

  close (): void {
    this.readyState = 2 // CLOSED
  }

  // Simplified event listener methods for the mock
  addEventListener (): void {
    // Not implemented for mock
  }

  removeEventListener (): void {
    // Not implemented for mock
  }

  dispatchEvent (): boolean {
    return false
  }
}

// Replace the global EventSource with our mock
const originalEventSource = global.EventSource
global.EventSource = MockEventSource as unknown as typeof EventSource

// Import dependencies after mocking
import { useChatStore } from '../../../../src/stores/chat-store'
import { useMessageStore } from '../../../../src/stores/unified-message-store'

describe.skip('MatrixService', () => {
  // Get store instances - these are mocked above
  const mockChatStore = useChatStore()
  const mockMessageStore = useMessageStore()
  let eventSource: MockEventSource

  // Setup for each test
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()

    // Create a fresh instance for each test
    eventSource = new MockEventSource('/api/matrix/events')

    // Mock EventSource creation globally
    vi.stubGlobal('EventSource', vi.fn().mockImplementation(() => {
      return eventSource
    }))

    // Reset service state by disconnecting
    matrixService.disconnect()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  afterAll(() => {
    // Restore original EventSource
    global.EventSource = originalEventSource
  })

  describe('connect', () => {
    it('should connect to Matrix events endpoint', async () => {
      const connectPromise = matrixService.connect()

      // Simulate successful connection
      eventSource.simulateOpen()

      const result = await connectPromise
      expect(result).toBe(true)
      expect(ensureMatrixUser).toHaveBeenCalled()
    })

    it('should fail to connect if user lacks Matrix credentials', async () => {
      vi.mocked(ensureMatrixUser).mockResolvedValueOnce(false)

      const result = await matrixService.connect()
      expect(result).toBe(false)
    })

    it('should handle connection errors and attempt reconnection', async () => {
      const connectPromise = matrixService.connect()

      // Simulate error
      eventSource.simulateError()

      const result = await connectPromise
      expect(result).toBe(false)

      // Should attempt reconnection
      expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 3000)
    })
  })

  describe('disconnect', () => {
    it('should close the EventSource connection', async () => {
      // First connect
      const connectPromise = matrixService.connect()
      await vi.runAllTimersAsync()

      eventSource = new MockEventSource('/api/matrix/events')
      eventSource.simulateOpen()

      await connectPromise

      // Create a spy on the close method
      const closeSpy = vi.spyOn(eventSource, 'close')

      // Now disconnect
      matrixService.disconnect()

      expect(closeSpy).toHaveBeenCalled()
    })

    it('should clear any pending reconnect timeouts', async () => {
      // First connect and then cause an error to trigger reconnect timeout
      const connectPromise = matrixService.connect()
      await vi.runAllTimersAsync()

      eventSource = new MockEventSource('/api/matrix/events')
      eventSource.simulateError()

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
      eventSource.simulateOpen()
      await connectPromise

      matrixService.addEventHandler(messageHandler)
    })

    it('should process and route Matrix message events to the chat store', async () => {
      const testMessage: MatrixMessage = {
        event_id: 'evt123',
        room_id: 'room123', // Match the active chat room
        sender: '@alice:matrix.org',
        content: {
          body: 'Hello world',
          msgtype: 'm.text'
        },
        origin_server_ts: Date.now(),
        type: 'm.room.message'
      }

      // Simulate receiving a message
      eventSource.simulateMessage(testMessage)

      // The message handler should be called
      expect(messageHandler).toHaveBeenCalledWith(testMessage)

      // The chat store should have received the message
      expect(mockChatStore.actionAddMessage).toHaveBeenCalledWith(testMessage)
    })

    it('should process and route Matrix message events to the unified message store', async () => {
      // Create a mock function that will be called to verify the store update
      const setMessages = vi.fn()

      // Create a custom mock message store
      const customMessageStore = {
        ...mockMessageStore,
        currentRoomMessages: [],
        // Replace the original store's functions with our mock
        addNewMessage: vi.fn()
      }

      // Override the store getter to return our custom version with proper typing
      vi.mocked(useMessageStore).mockReturnValueOnce({
        ...mockMessageStore,
        ...customMessageStore
      })

      const testMessage: MatrixMessage = {
        event_id: 'evt456',
        room_id: 'room456', // Match the discussion context ID
        sender: '@bob:matrix.org',
        content: {
          body: 'Discussion message',
          msgtype: 'm.text'
        },
        origin_server_ts: Date.now(),
        type: 'm.room.message'
      }

      // Simulate receiving a message
      eventSource.simulateMessage(testMessage)

      // The handler should be called
      expect(messageHandler).toHaveBeenCalledWith(testMessage)

      // The message store should have received the message
      expect(customMessageStore.addNewMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          event_id: 'evt456'
        })
      )
    })

    it('should handle Matrix typing events', async () => {
      // Create a mock function to verify the typing users update
      const setTypingUsers = vi.fn()

      // Create a custom chat store with our test values
      const customChatStore = {
        ...mockChatStore,
        typingUsers: {}
      }

      // Override the store getter to return our custom version with proper typing
      vi.mocked(useChatStore).mockReturnValueOnce({
        ...mockChatStore,
        ...customChatStore
      })

      const typingEvent: MatrixTypingIndicator = {
        room_id: 'room123',
        typing: ['@alice:matrix.org']
      }

      // Add the type field to match Matrix event structure
      const fullEvent = {
        ...typingEvent,
        type: 'm.typing'
      }

      // Simulate receiving a typing indicator
      eventSource.simulateMessage(fullEvent)

      // The typing users should be updated
      expect(setTypingUsers).toHaveBeenCalledWith({
        room123: ['@alice:matrix.org']
      })
    })

    it('should handle errors in event handlers gracefully', async () => {
      // Add a handler that throws an error
      const errorHandler = vi.fn().mockImplementation(() => {
        throw new Error('Test error')
      })

      matrixService.addEventHandler(errorHandler)

      // Mock console.error to verify it's called
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const testMessage: MatrixMessage = {
        event_id: 'evt789',
        room_id: 'room123',
        sender: '@charlie:matrix.org',
        content: {
          body: 'Error message',
          msgtype: 'm.text'
        },
        origin_server_ts: Date.now(),
        type: 'm.room.message'
      }

      // Simulate receiving a message
      eventSource.simulateMessage(testMessage)

      // The error handler should be called and error caught
      expect(errorHandler).toHaveBeenCalled()
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error in Matrix event handler:', expect.any(Error))

      // Other handlers should still be called
      expect(messageHandler).toHaveBeenCalledWith(testMessage)
    })

    it('should properly remove event handlers', async () => {
      // Remove the previously added handler
      matrixService.removeEventHandler(messageHandler)

      const testMessage: MatrixMessage = {
        event_id: 'evt999',
        room_id: 'room123',
        sender: '@david:matrix.org',
        content: {
          body: 'Remove handler test',
          msgtype: 'm.text'
        },
        origin_server_ts: Date.now(),
        type: 'm.room.message'
      }

      // Simulate receiving a message
      eventSource.simulateMessage(testMessage)

      // The removed handler should not be called
      expect(messageHandler).not.toHaveBeenCalled()
    })
  })

  describe('reconnection logic', () => {
    it('should attempt reconnection with exponential backoff', async () => {
      const connectPromise = matrixService.connect()
      await vi.runAllTimersAsync()

      eventSource = new MockEventSource('/api/matrix/events')
      eventSource.simulateError()

      await connectPromise

      // First reconnect attempt should be at 3000ms
      expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 3000)

      // Fast-forward past the first timeout
      vi.advanceTimersByTime(3000)

      // Simulate another failure
      eventSource.simulateError()

      // Second reconnect attempt should use exponential backoff (3000 * 1.5)
      expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 4500)

      // Fast-forward again
      vi.advanceTimersByTime(4500)

      // Simulate third failure
      eventSource.simulateError()

      // Third reconnect attempt (3000 * 1.5^2)
      expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 6750)
    })

    it('should stop trying to reconnect after max attempts', async () => {
      // This requires adjusting the MAX_RECONNECT_ATTEMPTS for testing
      // For now, we'll test the behavior over multiple reconnect attempts

      const connectPromise = matrixService.connect()
      await vi.runAllTimersAsync()

      eventSource = new MockEventSource('/api/matrix/events')
      eventSource.simulateError()

      await connectPromise

      // Simulate 5 failed reconnection attempts
      for (let i = 0; i < 5; i++) {
        const backoffMultiplier = Math.pow(1.5, i)
        const delay = 3000 * backoffMultiplier

        vi.advanceTimersByTime(delay)
        eventSource.simulateError()
      }

      // After 5 attempts, there should be no more setTimeout calls
      const timeoutCalls = vi.mocked(setTimeout).mock.calls.length

      vi.advanceTimersByTime(10000) // Advance time more

      // No new setTimeout calls should be made
      expect(vi.mocked(setTimeout).mock.calls.length).toBe(timeoutCalls)
    })

    it('should reset reconnection attempts on successful connection', async () => {
      // First connect and simulate error to trigger reconnect
      const connectPromise = matrixService.connect()
      await vi.runAllTimersAsync()

      eventSource = new MockEventSource('/api/matrix/events')
      eventSource.simulateError()

      await connectPromise

      // Fast-forward to first reconnect attempt
      vi.advanceTimersByTime(3000)

      // This time simulate successful connection
      eventSource.simulateOpen()

      // Now disconnect and connect again
      matrixService.disconnect()

      const secondConnectPromise = matrixService.connect()
      await vi.runAllTimersAsync()

      // Simulate error again
      eventSource.simulateError()

      await secondConnectPromise

      // First reconnect attempt should be at 3000ms again (not using exponential backoff from previous attempts)
      expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 3000)
    })
  })
})
