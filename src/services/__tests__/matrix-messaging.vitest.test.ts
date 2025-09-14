/**
 * Matrix Messaging Integration Tests - Behavior-Driven (Refactor-Resilient)
 *
 * These tests focus on messaging behavior that must work regardless
 * of how we restructure the internal messaging code.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Mock Storage for tests
const storageMock = () => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} }
  }
}

// Setup storage if not available
if (typeof localStorage === 'undefined') {
  Object.defineProperty(global, 'localStorage', { value: storageMock() })
}
if (typeof sessionStorage === 'undefined') {
  Object.defineProperty(global, 'sessionStorage', { value: storageMock() })
}

// Import current service for black-box testing
import { matrixClientManager } from '../../services/MatrixClientManager'

// Mock Matrix JS SDK to simulate messaging behavior
const mockMatrixClient = {
  isLoggedIn: vi.fn(() => true),
  sendEvent: vi.fn(),
  sendTyping: vi.fn(),
  uploadContent: vi.fn(),
  redactEvent: vi.fn(),
  sendReadReceipt: vi.fn(),
  getRoom: vi.fn(),
  getUserId: vi.fn(() => '@testuser:example.com'),
  getHomeserverUrl: vi.fn(() => 'https://matrix.example.com'),
  mxcUrlToHttp: vi.fn(),
  getCrypto: vi.fn(() => null) // Add missing crypto method
}

const mockRoom = {
  roomId: '!testroom:example.com',
  timeline: [],
  getUnfilteredTimelineSet: vi.fn(() => ({
    getLiveTimeline: vi.fn(() => ({
      getEvents: vi.fn(() => []),
      getPaginationToken: vi.fn(() => 'test-token')
    }))
  })),
  findEventById: vi.fn(),
  hasEncryptionStateEvent: vi.fn(() => false) // Add missing encryption method
}

// Mock external dependencies
vi.mock('../../utils/env', () => ({
  default: vi.fn((key: string) => {
    const mockConfig = {
      APP_MATRIX_HOMESERVER_URL: 'https://matrix.example.com',
      APP_MAS_URL: 'https://mas.example.com',
      APP_TENANT_ID: 'test-tenant'
    }
    return mockConfig[key as keyof typeof mockConfig]
  })
}))

vi.mock('../../stores/auth-store', () => ({
  useAuthStore: vi.fn(() => ({
    user: { slug: 'test-user', email: 'test@example.com' },
    token: 'valid-token',
    getUserSlug: 'test-user'
  }))
}))

// We don't mock MatrixClientManager - we test it directly
// Instead we'll inject our mock client into the real service

// Mock console methods
vi.mock('../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}))

describe('Matrix Messaging Integration (Behavior-Driven)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()

    // Clear any stored state
    localStorage.clear()
    sessionStorage.clear()

    // Set up default successful responses
    mockMatrixClient.sendEvent.mockResolvedValue({ event_id: '$test-event-id:example.com' })
    mockMatrixClient.uploadContent.mockResolvedValue({ content_uri: 'mxc://example.com/test-file' })
    mockMatrixClient.getRoom.mockReturnValue(mockRoom)
    mockMatrixClient.mxcUrlToHttp.mockReturnValue('https://matrix.example.com/_matrix/media/r0/download/example.com/test-file')

    // Inject mock client into the real MatrixClientManager
    // Access the private property for testing purposes
    ;(matrixClientManager as unknown as { client: typeof mockMatrixClient }).client = mockMatrixClient
  })

  describe('Message Sending', () => {
    it('should send text messages and return event ID', async () => {
      // GIVEN: A room and text message content
      const roomId = '!testroom:example.com'
      const messageContent = {
        body: 'Hello, Matrix!',
        msgtype: 'm.text'
      }

      // WHEN: Sending a message
      const result = await matrixClientManager.sendMessage(roomId, messageContent)

      // THEN: Should call Matrix SDK and return event ID
      expect(mockMatrixClient.sendEvent).toHaveBeenCalledWith(
        roomId,
        'm.room.message',
        messageContent
      )
      expect(result.eventId).toBe('$test-event-id:example.com')
    })

    it('should handle message sending failures gracefully', async () => {
      // GIVEN: Matrix client that fails to send
      mockMatrixClient.sendEvent.mockRejectedValue(new Error('Network error'))

      // WHEN: Attempting to send a message
      const messagePromise = matrixClientManager.sendMessage('!room:example.com', {
        body: 'Test message',
        msgtype: 'm.text'
      })

      // THEN: Should throw an error with context
      await expect(messagePromise).rejects.toThrow()
    })

    it('should require Matrix client to be initialized', async () => {
      // GIVEN: No Matrix client initialized
      ;(matrixClientManager as unknown as { client: null }).client = null

      // WHEN: Attempting to send a message
      const messagePromise = matrixClientManager.sendMessage('!room:example.com', {
        body: 'Test message',
        msgtype: 'm.text'
      })

      // THEN: Should reject with initialization error
      await expect(messagePromise).rejects.toThrow('Matrix client not initialized')
    })
  })

  describe('File Upload and Sharing', () => {
    it('should upload files and return content URI', async () => {
      // GIVEN: A file to upload
      const mockFile = new File(['test content'], 'test.txt', { type: 'text/plain' })

      // WHEN: Uploading the file
      const roomId = '!testroom:example.com'
      const result = await matrixClientManager.uploadAndSendFile(roomId, mockFile)

      // THEN: Should call Matrix upload and return result
      expect(mockMatrixClient.uploadContent).toHaveBeenCalledWith(mockFile, {
        name: 'test.txt',
        type: 'text/plain',
        rawResponse: false
      })
      expect(result).toHaveProperty('eventId')
      expect(result).toHaveProperty('url')
    })

    it('should upload and send files in one operation', async () => {
      // GIVEN: A file and room to share it in
      const mockFile = new File(['test content'], 'test.txt', { type: 'text/plain' })
      const roomId = '!testroom:example.com'

      // WHEN: Uploading and sending the file
      await matrixClientManager.uploadAndSendFile(roomId, mockFile)

      // THEN: Should upload file and send message
      expect(mockMatrixClient.uploadContent).toHaveBeenCalledWith(mockFile, {
        name: 'test.txt',
        type: 'text/plain',
        rawResponse: false
      })
      expect(mockMatrixClient.sendEvent).toHaveBeenCalledWith(
        roomId,
        'm.room.message',
        expect.objectContaining({
          msgtype: 'm.file',
          body: 'test.txt',
          filename: 'test.txt',
          url: 'mxc://example.com/test-file'
        })
      )
    })

    it('should handle upload failures appropriately', async () => {
      // GIVEN: Upload that fails
      mockMatrixClient.uploadContent.mockRejectedValue(new Error('Upload failed'))

      // WHEN: Attempting to upload
      const uploadPromise = matrixClientManager.uploadAndSendFile('!testroom:example.com', new File(['test'], 'test.txt'))

      // THEN: Should handle failure gracefully
      await expect(uploadPromise).rejects.toThrow()
    })
  })

  describe('Message Interaction', () => {
    it('should send typing indicators', async () => {
      // GIVEN: A room and typing state
      const roomId = '!testroom:example.com'

      // WHEN: Sending typing indicator
      await matrixClientManager.sendTyping(roomId, true, 5000)

      // THEN: Should call Matrix SDK with correct parameters
      expect(mockMatrixClient.sendTyping).toHaveBeenCalledWith(roomId, true, 5000)
    })

    it('should stop typing indicators', async () => {
      // GIVEN: A room where user was typing
      const roomId = '!testroom:example.com'

      // WHEN: Stopping typing indicator
      await matrixClientManager.sendTyping(roomId, false)

      // THEN: Should call Matrix SDK to stop typing
      expect(mockMatrixClient.sendTyping).toHaveBeenCalledWith(roomId, false, 10000)
    })

    it('should send read receipts for messages', async () => {
      // GIVEN: A room and event to mark as read
      const roomId = '!testroom:example.com'
      const eventId = '$test-event:example.com'

      // Mock the room and event
      const mockEvent = { getId: () => eventId }
      mockRoom.findEventById.mockReturnValue(mockEvent)

      // WHEN: Sending read receipt
      await matrixClientManager.sendReadReceipt(roomId, eventId)

      // THEN: Should call Matrix SDK with the event
      expect(mockMatrixClient.sendReadReceipt).toHaveBeenCalledWith(mockEvent)
    })
  })

  describe('Message Moderation', () => {
    it('should redact (delete) messages', async () => {
      // GIVEN: A message to redact
      const roomId = '!testroom:example.com'
      const eventId = '$bad-message:example.com'
      const reason = 'Inappropriate content'

      // WHEN: Redacting the message
      await matrixClientManager.redactMessage(roomId, eventId, reason)

      // THEN: Should call Matrix SDK redaction
      expect(mockMatrixClient.redactEvent).toHaveBeenCalledWith(roomId, eventId, reason)
    })

    it('should redact messages without reason', async () => {
      // GIVEN: A message to redact without specific reason
      const roomId = '!testroom:example.com'
      const eventId = '$bad-message:example.com'

      // WHEN: Redacting without reason
      await matrixClientManager.redactMessage(roomId, eventId)

      // THEN: Should call Matrix SDK redaction
      expect(mockMatrixClient.redactEvent).toHaveBeenCalledWith(roomId, eventId, undefined)
    })
  })

  describe('Content URL Handling', () => {
    it('should convert Matrix content URLs to HTTP URLs', () => {
      // GIVEN: A Matrix content URL
      const mxcUrl = 'mxc://example.com/test-content'

      // WHEN: Converting to HTTP URL
      const httpUrl = matrixClientManager.getContentUrl(mxcUrl)

      // THEN: Should return HTTP URL for media access
      expect(mockMatrixClient.mxcUrlToHttp).toHaveBeenCalledWith(mxcUrl)
      expect(httpUrl).toContain('https://')
    })

    it('should convert content URLs with dimensions for thumbnails', () => {
      // GIVEN: A Matrix content URL and thumbnail dimensions
      const mxcUrl = 'mxc://example.com/test-image'
      const width = 64
      const height = 64

      // WHEN: Converting to thumbnail URL
      const thumbnailUrl = matrixClientManager.getContentUrl(mxcUrl, width, height)

      // THEN: Should request thumbnail with dimensions
      expect(mockMatrixClient.mxcUrlToHttp).toHaveBeenCalledWith(mxcUrl, width, height, 'scale')
      expect(thumbnailUrl).toContain('https://')
    })

    it('should handle invalid content URLs gracefully', () => {
      // GIVEN: Invalid matrix content URL (doesn't start with mxc://)
      const invalidUrl = 'invalid-url'

      // WHEN: Converting invalid URL
      const result = matrixClientManager.getContentUrl(invalidUrl)

      // THEN: Should return the original URL as fallback (actual behavior)
      expect(result).toBe(invalidUrl)
    })
  })

  describe('Error Handling', () => {
    it('should require initialized client for all operations', async () => {
      // GIVEN: Uninitialized Matrix client
      ;(matrixClientManager as unknown as { client: null }).client = null

      // WHEN/THEN: All messaging operations should fail gracefully
      await expect(matrixClientManager.sendMessage('!room:example.com', { body: 'test', msgtype: 'm.text' }))
        .rejects.toThrow('Matrix client not initialized')

      await expect(matrixClientManager.uploadAndSendFile('!testroom:example.com', new File(['test'], 'test.txt')))
        .rejects.toThrow('Matrix client not initialized')

      await expect(matrixClientManager.sendTyping('!room:example.com', true))
        .rejects.toThrow('Matrix client not initialized')
    })

    it('should handle network failures gracefully', async () => {
      // GIVEN: Network connectivity issues
      mockMatrixClient.sendEvent.mockRejectedValue(new Error('Network timeout'))
      mockMatrixClient.uploadContent.mockRejectedValue(new Error('Upload timeout'))

      // WHEN: Operations fail due to network
      // THEN: Should propagate errors appropriately
      await expect(matrixClientManager.sendMessage('!room:example.com', { body: 'test', msgtype: 'm.text' }))
        .rejects.toThrow()

      await expect(matrixClientManager.uploadAndSendFile('!testroom:example.com', new File(['test'], 'test.txt')))
        .rejects.toThrow()
    })
  })
})

/**
 * Test Philosophy Notes:
 *
 * These messaging tests are designed to survive refactoring by:
 * 1. Testing the contract: sendMessage() -> { eventId }
 * 2. Testing behaviors: file upload -> content URI -> message with URL
 * 3. Testing error conditions: no client, network failures
 * 4. Avoiding implementation details: not testing internal method calls
 * 5. Focusing on user-facing outcomes: messages sent, files uploaded, receipts sent
 *
 * When we extract messaging into MatrixMessageService, these tests should
 * continue to pass by testing through whatever public interface we maintain.
 */
