// This file will be run before each test file
import { config } from '@vue/test-utils'
import { vi } from 'vitest'

config.global.mocks = {
  $t: (tKey: string): string => tKey // returns the translation key as a string
}

// Global type declarations
declare global {
  // eslint-disable-next-line no-var
  var __TEST_CLEANUP__: (() => void) | undefined
}

// Ensure document is available in test environment
if (typeof document === 'undefined') {
  Object.defineProperty(global, 'document', {
    value: {
      createElement: vi.fn(() => ({
        style: {},
        setAttribute: vi.fn(),
        getAttribute: vi.fn(),
        appendChild: vi.fn(),
        removeChild: vi.fn()
      })),
      body: {
        appendChild: vi.fn(),
        removeChild: vi.fn()
      },
      head: {
        appendChild: vi.fn(),
        removeChild: vi.fn()
      }
    }
  })
}

// Mock window for tests that need it
if (typeof window === 'undefined') {
  Object.defineProperty(global, 'window', {
    value: {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      location: {
        href: 'http://localhost:3000',
        pathname: '/',
        search: '',
        hash: ''
      },
      history: {
        pushState: vi.fn(),
        replaceState: vi.fn()
      }
    }
  })
}

// Mock Quasar's meta management to prevent document access in timeouts
if (typeof global !== 'undefined') {
  // Store original setTimeout to avoid infinite recursion
  const originalSetTimeout = global.setTimeout
  const originalClearTimeout = global.clearTimeout
  const activeTimeouts = new Set<ReturnType<typeof setTimeout>>()

  global.setTimeout = ((callback: (...args: unknown[]) => void, delay?: number, ...args: unknown[]) => {
    // If this looks like a Quasar meta update, return a fake timeout ID
    if (typeof callback === 'function') {
      const callbackStr = callback.toString()
      if (callbackStr.includes('document.createElement') ||
          callbackStr.includes('updateClientMeta') ||
          (delay && delay > 0 && callbackStr.includes('meta'))) {
        const fakeId = Math.random()
        activeTimeouts.add(fakeId)
        return fakeId as ReturnType<typeof setTimeout>
      }
    }

    // For all other timeouts, use original implementation but track them
    const timeoutId = originalSetTimeout(callback, delay, ...args)
    activeTimeouts.add(timeoutId)
    return timeoutId
  }) as typeof setTimeout

  global.clearTimeout = ((id: ReturnType<typeof setTimeout> | string | number | undefined) => {
    activeTimeouts.delete(id)
    return originalClearTimeout(id)
  }) as typeof clearTimeout

  // Cleanup function
  global.__TEST_CLEANUP__ = () => {
    activeTimeouts.forEach(id => {
      try {
        if (typeof id === 'number') {
          originalClearTimeout(id)
        }
      } catch (e) {
        // Ignore cleanup errors
      }
    })
    activeTimeouts.clear()
  }
}
