/**
 * Matrix Connection Debug Helper
 *
 * Utilities for debugging Matrix connection issues
 */

import { matrixClientManager } from '../services/MatrixClientManager'

/**
 * Debug Matrix connection state
 */
export function debugMatrixConnectionState (): void {
  try {
    const client = matrixClientManager.getClient()
    const isReady = matrixClientManager.isReady()
    // TODO: Re-enable when MatrixClientManager exposes these methods
    // const hasSession = matrixClientManager.hasStoredSession()
    // const hasChosen = matrixClientManager.hasUserChosenToConnect()

    console.log('🔍 Matrix Connection Debug State:', {
      hasClient: !!client,
      isReady,
      // hasSession,
      // hasChosen,
      clientLoggedIn: client?.isLoggedIn() || false,
      clientUserId: client?.getUserId() || 'none',
      clientDeviceId: client?.getDeviceId() || 'none'
    })

    // Check localStorage for Matrix-related keys
    const matrixKeys = Object.keys(localStorage).filter(key =>
      key.includes('matrix') || key.includes('mx_') || key.includes('oidc')
    )

    console.log('🔍 Matrix-related localStorage keys:', matrixKeys)

    // Check if user chose to connect flag is set correctly
    const authStore = (window as Window & { useAuthStore?: () => Record<string, unknown> }).useAuthStore?.() || {}
    const userSlug = authStore.getUserSlug || (authStore.user as { slug?: string } | undefined)?.slug

    if (userSlug) {
      const userConnectKey = `matrix_user_chosen_to_connect_${userSlug}`
      const hasUserConnectFlag = localStorage.getItem(userConnectKey) === 'true'
      console.log('🔍 User connect flag:', {
        userSlug,
        key: userConnectKey,
        value: hasUserConnectFlag
      })
    }
  } catch (error) {
    console.error('❌ Matrix connection debug error:', error)
  }
}

/**
 * Force clear Matrix connection state (for testing)
 */
export function clearMatrixConnectionState (): void {
  try {
    console.log('🧹 Clearing Matrix connection state...')

    // Clear localStorage Matrix keys
    const keysToRemove = Object.keys(localStorage).filter(key =>
      key.includes('matrix') || key.includes('mx_') || key.includes('oidc')
    )

    keysToRemove.forEach(key => {
      localStorage.removeItem(key)
      console.log(`🗑️ Removed: ${key}`)
    })

    // Clear sessionStorage
    const sessionKeys = Object.keys(sessionStorage).filter(key =>
      key.includes('matrix') || key.includes('mx_') || key.includes('oidc')
    )

    sessionKeys.forEach(key => {
      sessionStorage.removeItem(key)
      console.log(`🗑️ Removed from session: ${key}`)
    })

    console.log('✅ Matrix connection state cleared')
  } catch (error) {
    console.error('❌ Failed to clear Matrix state:', error)
  }
}

/**
 * Test Matrix connection manually
 */
export async function testMatrixConnection (): Promise<void> {
  try {
    console.log('🧪 Testing Matrix connection...')

    // First check current state
    debugMatrixConnectionState()

    // Check if client is available
    console.log('🔗 Checking Matrix client availability...')
    if (matrixClientManager.isClientAvailable()) {
      console.log('✅ Matrix client is available and ready')
    } else {
      console.log('❌ Matrix client is not available - user may need to authenticate')
    }

    console.log('✅ Matrix connection check completed')
  } catch (error) {
    console.error('❌ Matrix connection test failed:', error)
  }
}

/**
 * Listen for Matrix connection events
 */
export function setupMatrixConnectionListener (): () => void {
  const listeners: Array<{ event: string, handler: (event: Event) => void }> = []

  const events = [
    'matrix-client-ready',
    'matrix-client-connected',
    'matrix-encryption-ready',
    'matrix-encryption-failed',
    'matrix-reset-completed'
  ]

  events.forEach(eventName => {
    const handler = (event: Event) => {
      console.log(`🎉 Matrix Event: ${eventName}`, (event as CustomEvent).detail)
    }

    window.addEventListener(eventName, handler)
    listeners.push({ event: eventName, handler })
  })

  console.log('👂 Matrix connection event listeners set up')

  // Return cleanup function
  return () => {
    listeners.forEach(({ event, handler }) => {
      window.removeEventListener(event, handler)
    })
    console.log('🧹 Matrix connection event listeners cleaned up')
  }
}

// Add to window for easy access in browser console
if (typeof window !== 'undefined') {
  (window as Window & { matrixConnectionDebug?: Record<string, unknown> }).matrixConnectionDebug = {
    debugState: debugMatrixConnectionState,
    clearState: clearMatrixConnectionState,
    testConnection: testMatrixConnection,
    setupListener: setupMatrixConnectionListener
  }

  console.log('🔧 Matrix connection debug tools available at window.matrixConnectionDebug')
}
