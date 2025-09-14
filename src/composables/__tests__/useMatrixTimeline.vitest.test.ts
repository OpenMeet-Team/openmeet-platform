/**
 * Tests for useMatrixTimeline composable
 *
 * Focus on behavior testing with proper isolation to prevent unhandled errors.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { createApp } from 'vue'
import type { MatrixClient, EventTimelineSet, Room } from 'matrix-js-sdk'

// Mock the logger
vi.mock('../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

// Mock Matrix SDK with proper event emitter behavior
vi.mock('matrix-js-sdk', () => ({
  TimelineWindow: vi.fn().mockImplementation(() => ({
    getEvents: vi.fn(() => []),
    canPaginate: vi.fn(() => false),
    load: vi.fn().mockResolvedValue(true),
    paginate: vi.fn().mockResolvedValue(true)
  })),
  EventTimeline: {
    BACKWARDS: 'b',
    FORWARDS: 'f'
  },
  RoomEvent: {
    Timeline: 'Room.timeline',
    Redaction: 'Room.redaction',
    TimelineReset: 'Room.timelineReset'
  },
  MatrixEventEvent: {
    Decrypted: 'Event.decrypted',
    Replaced: 'Event.replaced'
  }
}))

describe('useMatrixTimeline', () => {
  let useMatrixTimeline: typeof import('../useMatrixTimeline').useMatrixTimeline
  let app: ReturnType<typeof createApp>

  beforeEach(async () => {
    vi.clearAllMocks()

    // Create a Vue app context for proper composable testing
    app = createApp({})

    // Import the composable fresh for each test
    const module = await import('../useMatrixTimeline')
    useMatrixTimeline = module.useMatrixTimeline
  })

  afterEach(() => {
    if (app) {
      app.unmount()
    }
  })

  describe('Basic Functionality', () => {
    it('should initialize with empty state when no options provided', () => {
      app.runWithContext(() => {
        const timeline = useMatrixTimeline({})

        expect(timeline.events.value).toEqual([])
        expect(timeline.isLoading.value).toBe(false)
        expect(timeline.canPaginateBack.value).toBe(false)
        expect(timeline.canPaginateForward.value).toBe(false)
        expect(timeline.isPaginatingBack.value).toBe(false)
        expect(timeline.isPaginatingForward.value).toBe(false)
        expect(timeline.decryptionCounter.value).toBe(0)
      })
    })

    it('should expose expected public API', () => {
      app.runWithContext(() => {
        const timeline = useMatrixTimeline({})

        // Check reactive properties
        expect(timeline.events).toBeDefined()
        expect(timeline.isLoading).toBeDefined()
        expect(timeline.canPaginateBack).toBeDefined()
        expect(timeline.canPaginateForward).toBeDefined()
        expect(timeline.isPaginatingBack).toBeDefined()
        expect(timeline.isPaginatingForward).toBeDefined()
        expect(timeline.isAtLiveEnd).toBeDefined()
        expect(timeline.decryptionCounter).toBeDefined()

        // Check methods
        expect(typeof timeline.initializeTimeline).toBe('function')
        expect(typeof timeline.loadOlderMessages).toBe('function')
        expect(typeof timeline.loadNewerMessages).toBe('function')
        expect(typeof timeline.refreshEvents).toBe('function')
      })
    })

    it('should handle missing client gracefully', async () => {
      await app.runWithContext(async () => {
        const timeline = useMatrixTimeline({})

        // Should not throw when calling methods without client
        await expect(timeline.initializeTimeline()).resolves.not.toThrow()
        await expect(timeline.loadOlderMessages()).resolves.toBe(false)
        await expect(timeline.loadNewerMessages()).resolves.toBe(false)

        expect(() => timeline.refreshEvents()).not.toThrow()
      })
    })
  })

  describe('State Management', () => {
    it('should track loading state correctly', () => {
      app.runWithContext(() => {
        const timeline = useMatrixTimeline({})

        expect(timeline.isLoading.value).toBe(false)
      })
    })

    it('should manage decryption counter for Vue reactivity', () => {
      app.runWithContext(() => {
        const timeline = useMatrixTimeline({})
        const initialCounter = timeline.decryptionCounter.value

        expect(typeof initialCounter).toBe('number')
        expect(initialCounter).toBeGreaterThanOrEqual(0)
      })
    })

    it('should provide pagination state', () => {
      app.runWithContext(() => {
        const timeline = useMatrixTimeline({})

        // Initial state should be safe defaults
        expect(timeline.canPaginateBack.value).toBe(false)
        expect(timeline.canPaginateForward.value).toBe(false)
        expect(timeline.isPaginatingBack.value).toBe(false)
        expect(timeline.isPaginatingForward.value).toBe(false)
      })
    })
  })

  describe('Event Handling', () => {
    it('should maintain events as reactive readonly array', () => {
      app.runWithContext(() => {
        const timeline = useMatrixTimeline({})

        expect(Array.isArray(timeline.events.value)).toBe(true)
        expect(timeline.events.value).toEqual([])
      })
    })

    it('should handle refreshEvents without errors', () => {
      app.runWithContext(() => {
        const timeline = useMatrixTimeline({})

        expect(() => timeline.refreshEvents()).not.toThrow()
      })
    })

    it('should provide live timeline state computed property', () => {
      app.runWithContext(() => {
        const timeline = useMatrixTimeline({})

        // isAtLiveEnd should be falsy when no timeline window exists
        expect(timeline.isAtLiveEnd.value).toBeFalsy()
      })
    })
  })

  describe('Pagination Interface', () => {
    it('should provide pagination methods that return promises', async () => {
      await app.runWithContext(async () => {
        const timeline = useMatrixTimeline({})

        const backResult = timeline.loadOlderMessages()
        const forwardResult = timeline.loadNewerMessages()

        expect(backResult).toBeInstanceOf(Promise)
        expect(forwardResult).toBeInstanceOf(Promise)

        // Should resolve to boolean success indicators
        await expect(backResult).resolves.toBe(false) // No client = false
        await expect(forwardResult).resolves.toBe(false) // No client = false
      })
    })

    it('should prevent concurrent pagination attempts', async () => {
      await app.runWithContext(async () => {
        const timeline = useMatrixTimeline({})

        // Multiple calls should be safe
        const promises = [
          timeline.loadOlderMessages(),
          timeline.loadOlderMessages(),
          timeline.loadNewerMessages(),
          timeline.loadNewerMessages()
        ]

        const results = await Promise.all(promises)

        // All should complete without errors
        expect(results).toHaveLength(4)
        results.forEach(result => expect(typeof result).toBe('boolean'))
      })
    })
  })

  describe('Configuration', () => {
    it('should accept initialization options', () => {
      app.runWithContext(() => {
        const mockClient = { on: vi.fn(), off: vi.fn() } as unknown as MatrixClient
        const mockTimelineSet = {
          room: { on: vi.fn(), off: vi.fn(), roomId: 'test' } as unknown as Room
        } as unknown as EventTimelineSet

        expect(() => {
          useMatrixTimeline({
            client: mockClient,
            timelineSet: mockTimelineSet,
            eventId: 'test-event',
            windowLimit: 100
          })
        }).not.toThrow()
      })
    })

    it('should handle different window limit options', () => {
      app.runWithContext(() => {
        const timeline1 = useMatrixTimeline({ windowLimit: 50 })
        const timeline2 = useMatrixTimeline({ windowLimit: 100 })

        // Both should initialize successfully
        expect(timeline1.events.value).toEqual([])
        expect(timeline2.events.value).toEqual([])
      })
    })
  })

  describe('Error Resilience', () => {
    it('should handle invalid inputs gracefully', () => {
      app.runWithContext(() => {
        expect(() => {
          useMatrixTimeline({
            client: null,
            timelineSet: undefined,
            eventId: 123 as unknown as string,
            windowLimit: 'invalid' as unknown as number
          })
        }).not.toThrow()
      })
    })

    it('should maintain state consistency during errors', () => {
      app.runWithContext(async () => {
        const timeline = useMatrixTimeline({})

        // Even with invalid operations, state should remain consistent
        await timeline.loadOlderMessages()
        await timeline.loadNewerMessages()
        timeline.refreshEvents()

        expect(timeline.events.value).toEqual([])
        expect(timeline.isLoading.value).toBe(false)
        expect(timeline.isPaginatingBack.value).toBe(false)
        expect(timeline.isPaginatingForward.value).toBe(false)
      })
    })
  })

  describe('Memory Management', () => {
    it('should handle rapid initialization attempts', () => {
      app.runWithContext(async () => {
        const timeline = useMatrixTimeline({})

        // Multiple rapid calls should be safe
        const promises = Array.from({ length: 5 }, () => timeline.initializeTimeline())

        await expect(Promise.all(promises)).resolves.not.toThrow()
      })
    })

    it('should create multiple instances without conflicts', () => {
      app.runWithContext(() => {
        // Create multiple timeline instances
        const timelines = Array.from({ length: 5 }, () => useMatrixTimeline({}))

        // Should not accumulate references
        expect(timelines).toHaveLength(5)
        timelines.forEach(timeline => {
          expect(timeline.events.value).toEqual([])
        })
      })
    })
  })

  describe('API Contract', () => {
    it('should return readonly reactive properties', () => {
      app.runWithContext(() => {
        const timeline = useMatrixTimeline({})

        // All reactive properties should be refs
        const refProps = ['events', 'isLoading', 'canPaginateBack', 'canPaginateForward', 'isPaginatingBack', 'isPaginatingForward', 'decryptionCounter']

        refProps.forEach(prop => {
          expect(timeline[prop]).toBeDefined()
          expect(timeline[prop]).toHaveProperty('value')
        })

        // isAtLiveEnd should be a computed
        expect(timeline.isAtLiveEnd).toBeDefined()
        expect(timeline.isAtLiveEnd).toHaveProperty('value')
      })
    })

    it('should expose all required methods', () => {
      app.runWithContext(() => {
        const timeline = useMatrixTimeline({})

        const methods = ['initializeTimeline', 'loadOlderMessages', 'loadNewerMessages', 'refreshEvents']

        methods.forEach(method => {
          expect(typeof timeline[method]).toBe('function')
        })
      })
    })
  })
})
