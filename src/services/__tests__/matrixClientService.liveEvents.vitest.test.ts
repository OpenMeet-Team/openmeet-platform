/**
 * Test for Matrix client live event synchronization
 * This test verifies that the Matrix client properly starts and receives live events
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { matrixClientService } from '../matrixClientService'
import { createClient } from 'matrix-js-sdk'

// Mock the Matrix SDK
vi.mock('matrix-js-sdk', () => ({
  createClient: vi.fn(),
  RoomEvent: {
    Timeline: 'Room.timeline'
  },
  ClientEvent: {
    Sync: 'sync'
  },
  RoomMemberEvent: {
    Typing: 'RoomMember.typing',
    Membership: 'RoomMember.membership'
  },
  IndexedDBStore: vi.fn(),
  IndexedDBCryptoStore: vi.fn(),
  Direction: {
    Backward: 'b'
  }
}))

describe('Matrix Client Live Events', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockClient: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockRoom: any
  // eslint-disable-next-line @typescript-eslint/ban-types
  let mockEventListeners: Map<string, Function[]>

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()

    mockEventListeners = new Map()

    // Mock Matrix client
    mockClient = {
      isLoggedIn: vi.fn(() => true),
      getUserId: vi.fn(() => '@test:matrix.org'),
      getHomeserverUrl: vi.fn(() => 'http://localhost:8448'),
      whoami: vi.fn(() => Promise.resolve({ user_id: '@test:matrix.org' })),
      startClient: vi.fn(() => Promise.resolve()),
      stopClient: vi.fn(),
      getSyncState: vi.fn(() => 'PREPARED'),
      isInitialSyncComplete: vi.fn(() => true),
      getCrypto: vi.fn(() => null),
      getRooms: vi.fn(() => [mockRoom]),
      getRoom: vi.fn(() => mockRoom),
      // eslint-disable-next-line @typescript-eslint/ban-types
      on: vi.fn((event: string, callback: Function) => {
        if (!mockEventListeners.has(event)) {
          mockEventListeners.set(event, [])
        }
        mockEventListeners.get(event)!.push(callback)
      }),
      removeListener: vi.fn()
    }

    // Mock Matrix room
    mockRoom = {
      roomId: '!test:matrix.org',
      name: 'Test Room',
      getJoinedMembers: vi.fn(() => []),
      timeline: [],
      on: vi.fn(),
      removeListener: vi.fn()
    }

    // Mock createClient to return our mock client
    vi.mocked(createClient).mockReturnValue(mockClient)
  })

  afterEach(() => {
    // Clean up
    vi.clearAllMocks()
  })

  it('should start Matrix client with proper sync settings', async () => {
    // Mock credentials
    const credentials = {
      userId: '@test:matrix.org',
      accessToken: 'test-token',
      deviceId: 'test-device',
      homeserverUrl: 'http://localhost:8448'
    }

    // Call the private method through reflection (for testing)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = matrixClientService as any
    await service._createClientFromCredentials(credentials)

    // Verify startClient was called with correct parameters
    expect(mockClient.startClient).toHaveBeenCalledWith({
      initialSyncLimit: 50,
      includeArchivedRooms: false,
      lazyLoadMembers: true
    })
  })

  it('should set up event listeners for live message sync', async () => {
    const credentials = {
      userId: '@test:matrix.org',
      accessToken: 'test-token',
      deviceId: 'test-device',
      homeserverUrl: 'http://localhost:8448'
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = matrixClientService as any
    await service._createClientFromCredentials(credentials)

    // Verify event listeners were set up
    expect(mockClient.on).toHaveBeenCalledWith('Room.timeline', expect.any(Function))
    expect(mockClient.on).toHaveBeenCalledWith('sync', expect.any(Function))
  })

  it('should handle timeline events and add them to room timeline', async () => {
    const credentials = {
      userId: '@test:matrix.org',
      accessToken: 'test-token',
      deviceId: 'test-device',
      homeserverUrl: 'http://localhost:8448'
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = matrixClientService as any
    await service._createClientFromCredentials(credentials)

    // Create a mock timeline event
    const mockEvent = {
      getType: vi.fn(() => 'm.room.message'),
      getId: vi.fn(() => '$event-id'),
      getSender: vi.fn(() => '@other:matrix.org'),
      getContent: vi.fn(() => ({ body: 'Test message', msgtype: 'm.text' })),
      getTs: vi.fn(() => Date.now())
    }

    // Simulate a timeline event
    const timelineListener = mockEventListeners.get('Room.timeline')![0]
    timelineListener(mockEvent, mockRoom, false)

    // Verify the event was processed
    expect(mockEvent.getType).toHaveBeenCalled()
    expect(mockEvent.getId).toHaveBeenCalled()
    expect(mockEvent.getSender).toHaveBeenCalled()
  })

  it('should handle sync state changes correctly', async () => {
    const credentials = {
      userId: '@test:matrix.org',
      accessToken: 'test-token',
      deviceId: 'test-device',
      homeserverUrl: 'http://localhost:8448'
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = matrixClientService as any
    await service._createClientFromCredentials(credentials)

    // Get the sync listener
    const syncListener = mockEventListeners.get('sync')![0]

    // Test different sync states
    const consoleSpy = vi.spyOn(console, 'log')

    // Test PREPARED state
    syncListener('PREPARED', null, {})
    expect(consoleSpy).toHaveBeenCalledWith('✅ Matrix client fully synced and ready')

    // Test SYNCING state
    syncListener('SYNCING', 'PREPARED', {})
    expect(consoleSpy).toHaveBeenCalledWith('🔄 Matrix client syncing...')

    // Test ERROR state
    mockClient.getSyncState.mockReturnValue('ERROR')
    syncListener('ERROR', 'SYNCING', { error: 'test error' })
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('❌ Matrix sync error:'))
  })

  it('should restart client on sync error', async () => {
    const credentials = {
      userId: '@test:matrix.org',
      accessToken: 'test-token',
      deviceId: 'test-device',
      homeserverUrl: 'http://localhost:8448'
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = matrixClientService as any
    await service._createClientFromCredentials(credentials)

    // Get the sync listener
    const syncListener = mockEventListeners.get('sync')![0]

    // Mock sync state as ERROR
    mockClient.getSyncState.mockReturnValue('ERROR')

    // Trigger error state
    syncListener('ERROR', 'SYNCING', { error: 'test error' })

    // Wait for timeout to trigger restart
    await new Promise(resolve => setTimeout(resolve, 5100))

    // Verify startClient was called again (restart)
    expect(mockClient.startClient).toHaveBeenCalledTimes(2)
  })

  it('should verify client is ready after sync', async () => {
    const credentials = {
      userId: '@test:matrix.org',
      accessToken: 'test-token',
      deviceId: 'test-device',
      homeserverUrl: 'http://localhost:8448'
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = matrixClientService as any
    await service._createClientFromCredentials(credentials)

    // Test isReady method
    expect(service.isReady()).toBe(true)
    expect(mockClient.isLoggedIn).toHaveBeenCalled()
  })

  it('should handle room not found scenario', async () => {
    const credentials = {
      userId: '@test:matrix.org',
      accessToken: 'test-token',
      deviceId: 'test-device',
      homeserverUrl: 'http://localhost:8448'
    }

    // Mock getRoom to return null (room not found)
    mockClient.getRoom.mockReturnValue(null)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = matrixClientService as any
    await service._createClientFromCredentials(credentials)

    // Verify client still starts even if specific room not found
    expect(mockClient.startClient).toHaveBeenCalled()
  })
})
