import { describe, it, expect, vi, afterEach } from 'vitest'
import type { MatrixClient } from 'matrix-js-sdk'

/**
 * App-startup Matrix session restore
 *
 * The auth store starts the restore in the background on page load. Chat components
 * can mount before it finishes, so they need a way to wait for it before deciding
 * the stored session is unusable.
 */

vi.mock('../../../../src/stores/auth-store', () => ({
  useAuthStore: vi.fn(() => ({
    getUserSlug: 'test-user-slug',
    isInitialized: true,
    waitForInitialization: async () => {}
  }))
}))

const { matrixClientManager } = await import('../../../../src/services/MatrixClientManager')

function deferred<T> () {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((_resolve) => { resolve = _resolve })
  return { promise, resolve }
}

const tick = () => new Promise(resolve => setTimeout(resolve, 0))

afterEach(() => {
  vi.restoreAllMocks()
})

describe('MatrixClientManager - startup session restore', () => {
  it('waitForStartupRestore() resolves only after the startup restore settles', async () => {
    const restore = deferred<MatrixClient | null>()
    vi.spyOn(matrixClientManager, 'initializeClient').mockReturnValue(restore.promise)

    const startup = matrixClientManager.initializeClientWhenReady()

    let settled = false
    const waiting = matrixClientManager.waitForStartupRestore().then(() => { settled = true })

    await tick()
    expect(settled).toBe(false)

    restore.resolve(null)
    await startup
    await waiting
    expect(settled).toBe(true)
  })

  it('waitForStartupRestore() resolves even when the restore fails', async () => {
    vi.spyOn(matrixClientManager, 'initializeClient').mockRejectedValue(new Error('restore failed'))

    const startup = matrixClientManager.initializeClientWhenReady()

    await expect(matrixClientManager.waitForStartupRestore()).resolves.toBeUndefined()
    await expect(startup).rejects.toThrow('restore failed')
  })

  it('waitForStartupRestore() resolves immediately when nothing is restoring', async () => {
    await expect(matrixClientManager.waitForStartupRestore()).resolves.toBeUndefined()
  })

  it('shares one restore between concurrent startup calls', async () => {
    const restore = deferred<MatrixClient | null>()
    const initializeClient = vi.spyOn(matrixClientManager, 'initializeClient').mockReturnValue(restore.promise)

    const first = matrixClientManager.initializeClientWhenReady()
    const second = matrixClientManager.initializeClientWhenReady()

    restore.resolve(null)
    await Promise.all([first, second])

    expect(initializeClient).toHaveBeenCalledTimes(1)
  })
})
