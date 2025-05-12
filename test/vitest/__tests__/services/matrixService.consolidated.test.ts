/**
 * Matrix Service Tests - Consolidated working tests
 *
 * This test file contains only well-tested and reliable tests
 * for the Matrix functionality that don't require network access.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { matrixService } from '../../../../src/services/matrixService'

// Setup window global for test
declare global {
  interface Window {
    APP_CONFIG?: {
      APP_TENANT_ID?: string;
    };
  }
}

// This simplified approach avoids complex mocking of dependencies
// which was causing the tests to fail due to hoisting issues.

describe('MatrixService', () => {
  beforeEach(() => {
    // Ensure we have a clean state for each test
    matrixService.disconnect()

    // Set up global environment with tenant ID which is needed for some tests
    window.APP_CONFIG = {
      APP_TENANT_ID: 'test-tenant'
    }

    // Mock localStorage for tenant ID access
    Storage.prototype.getItem = vi.fn((key) => {
      if (key === 'tenantId') return 'test-tenant'
      return null
    })

    Storage.prototype.setItem = vi.fn()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Joined Rooms Cache', () => {
    it('should track joined rooms correctly', () => {
      const roomId = 'test-room-123'

      // Initially the room should not be joined
      expect(matrixService.isRoomJoined(roomId)).toBe(false)

      // Mark the room as joined
      matrixService.markRoomAsJoined(roomId)

      // Now it should be joined
      expect(matrixService.isRoomJoined(roomId)).toBe(true)

      // Disconnecting should clear the cache
      matrixService.disconnect()

      // The room should no longer be joined
      expect(matrixService.isRoomJoined(roomId)).toBe(false)
    })

    it('should track multiple rooms correctly', () => {
      const roomIds = ['room-1', 'room-2', 'room-3']

      // Mark all rooms as joined
      roomIds.forEach(roomId => {
        expect(matrixService.isRoomJoined(roomId)).toBe(false)
        matrixService.markRoomAsJoined(roomId)
        expect(matrixService.isRoomJoined(roomId)).toBe(true)
      })

      // Disconnecting should clear all rooms
      matrixService.disconnect()

      // All rooms should no longer be joined
      roomIds.forEach(roomId => {
        expect(matrixService.isRoomJoined(roomId)).toBe(false)
      })
    })
  })

  describe('Event Handlers', () => {
    it('should allow adding and removing event handlers', () => {
      // We can test adding and removing handlers without triggering events
      const mockHandler1 = vi.fn()
      const mockHandler2 = vi.fn()

      // Add handlers
      matrixService.addEventHandler(mockHandler1)
      matrixService.addEventHandler(mockHandler2)

      // Remove one handler
      matrixService.removeEventHandler(mockHandler1)

      // We can't easily test if they're called since the method using them is private
      // But we can verify the methods exist and don't throw errors
      expect(() => matrixService.addEventHandler(mockHandler1)).not.toThrow()
      expect(() => matrixService.removeEventHandler(mockHandler2)).not.toThrow()
    })
  })
})
