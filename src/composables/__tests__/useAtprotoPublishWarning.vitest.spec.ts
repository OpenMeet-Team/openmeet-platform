import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAtprotoPublishWarning } from '../useAtprotoPublishWarning'

// Mock Quasar Notify
const mockNotifyCreate = vi.fn()
vi.mock('quasar', () => ({
  Notify: {
    create: (...args: unknown[]) => mockNotifyCreate(...args)
  }
}))

// Mock vue-router
const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockPush
  })
}))

// Mock auth store
const mockAuthStore = {
  user: null as Record<string, unknown> | null
}
vi.mock('../../stores/auth-store', () => ({
  useAuthStore: () => mockAuthStore
}))

describe('useAtprotoPublishWarning', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthStore.user = null
  })

  it('should not show warning when user has no atprotoIdentity', () => {
    mockAuthStore.user = { id: 1, name: 'Test' }
    const { warnIfNeeded } = useAtprotoPublishWarning()
    warnIfNeeded()
    expect(mockNotifyCreate).not.toHaveBeenCalled()
  })

  it('should not show warning when atprotoIdentity is null', () => {
    mockAuthStore.user = { id: 1, atprotoIdentity: null }
    const { warnIfNeeded } = useAtprotoPublishWarning()
    warnIfNeeded()
    expect(mockNotifyCreate).not.toHaveBeenCalled()
  })

  it('should not show warning when user is custodial', () => {
    mockAuthStore.user = {
      id: 1,
      atprotoIdentity: {
        isCustodial: true,
        hasActiveSession: false
      }
    }
    const { warnIfNeeded } = useAtprotoPublishWarning()
    warnIfNeeded()
    expect(mockNotifyCreate).not.toHaveBeenCalled()
  })

  it('should not show warning when session is active', () => {
    mockAuthStore.user = {
      id: 1,
      atprotoIdentity: {
        isCustodial: false,
        hasActiveSession: true
      }
    }
    const { warnIfNeeded } = useAtprotoPublishWarning()
    warnIfNeeded()
    expect(mockNotifyCreate).not.toHaveBeenCalled()
  })

  it('should show warning when non-custodial user has expired session', () => {
    mockAuthStore.user = {
      id: 1,
      atprotoIdentity: {
        isCustodial: false,
        hasActiveSession: false
      }
    }
    const { warnIfNeeded } = useAtprotoPublishWarning()
    warnIfNeeded()
    expect(mockNotifyCreate).toHaveBeenCalledTimes(1)

    const call = mockNotifyCreate.mock.calls[0][0]
    expect(call.type).toBe('warning')
    expect(call.message).toContain('AT Protocol session has expired')
    expect(call.position).toBe('top')
    expect(call.timeout).toBe(8000)
  })

  it('should include a "Go to Profile" action button', () => {
    mockAuthStore.user = {
      id: 1,
      atprotoIdentity: {
        isCustodial: false,
        hasActiveSession: false
      }
    }
    const { warnIfNeeded } = useAtprotoPublishWarning()
    warnIfNeeded()

    const call = mockNotifyCreate.mock.calls[0][0]
    expect(call.actions).toBeDefined()
    expect(call.actions).toHaveLength(1)
    expect(call.actions[0].label).toBe('Go to Profile')
  })

  it('should navigate to profile when action button is clicked', () => {
    mockAuthStore.user = {
      id: 1,
      atprotoIdentity: {
        isCustodial: false,
        hasActiveSession: false
      }
    }
    const { warnIfNeeded } = useAtprotoPublishWarning()
    warnIfNeeded()

    const call = mockNotifyCreate.mock.calls[0][0]
    // Simulate clicking the action button
    call.actions[0].handler()
    expect(mockPush).toHaveBeenCalledWith('/dashboard/profile')
  })

  it('should not show warning when user is null', () => {
    mockAuthStore.user = null
    const { warnIfNeeded } = useAtprotoPublishWarning()
    warnIfNeeded()
    expect(mockNotifyCreate).not.toHaveBeenCalled()
  })

  describe('needsRelink', () => {
    it('should return true when non-custodial user has expired session', () => {
      mockAuthStore.user = {
        id: 1,
        atprotoIdentity: {
          isCustodial: false,
          hasActiveSession: false
        }
      }
      const { needsRelink } = useAtprotoPublishWarning()
      expect(needsRelink.value).toBe(true)
    })

    it('should return false when user has active session', () => {
      mockAuthStore.user = {
        id: 1,
        atprotoIdentity: {
          isCustodial: false,
          hasActiveSession: true
        }
      }
      const { needsRelink } = useAtprotoPublishWarning()
      expect(needsRelink.value).toBe(false)
    })

    it('should return false when user is custodial', () => {
      mockAuthStore.user = {
        id: 1,
        atprotoIdentity: {
          isCustodial: true,
          hasActiveSession: false
        }
      }
      const { needsRelink } = useAtprotoPublishWarning()
      expect(needsRelink.value).toBe(false)
    })

    it('should return false when no atprotoIdentity', () => {
      mockAuthStore.user = { id: 1 }
      const { needsRelink } = useAtprotoPublishWarning()
      expect(needsRelink.value).toBe(false)
    })
  })
})
