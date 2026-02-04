/**
 * Cross-Tab Token Refresh Coordination Service
 *
 * This service ensures that only one tab refreshes tokens at a time when
 * refresh tokens rotate (each refresh invalidates the previous refresh token).
 *
 * Uses BroadcastChannel API with localStorage fallback for older browsers.
 */

import { logger } from '../utils/logger'
import { useAuthStore } from '../stores/auth-store'

interface TokenRefreshMessage {
  type: 'refresh_started' | 'refresh_completed' | 'refresh_failed' | 'tokens_updated'
  timestamp: number
  tabId: string
  token?: string
  refreshToken?: string
  tokenExpires?: number
}

interface StorageCoordination {
  isRefreshing: boolean
  tabId: string
  timestamp: number
  token?: string
  refreshToken?: string
  tokenExpires?: number
}

export class CrossTabTokenService {
  // eslint-disable-next-line no-use-before-define
  private static instance: CrossTabTokenService | null = null
  private channel: BroadcastChannel | null = null
  private tabId: string
  private refreshPromise: Promise<string> | null = null
  private isRefreshing = false
  private listeners: Map<string, Set<(data: TokenRefreshMessage) => void>> = new Map()
  private cleanupIntervalId: ReturnType<typeof setInterval> | null = null

  // Storage keys for fallback coordination
  private readonly STORAGE_KEY = 'openmeet_token_refresh_coordination'
  private readonly LOCK_TIMEOUT = 10000 // 10 seconds max for a refresh operation

  private constructor () {
    this.tabId = this.generateTabId()
    this.initializeBroadcastChannel()
    this.setupStorageEventListener()
    this.cleanupStaleRefreshLocks()
  }

  public static getInstance (): CrossTabTokenService {
    if (!CrossTabTokenService.instance) {
      CrossTabTokenService.instance = new CrossTabTokenService()
    }
    return CrossTabTokenService.instance
  }

  private generateTabId (): string {
    return `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private initializeBroadcastChannel (): void {
    if (typeof BroadcastChannel === 'undefined') {
      logger.warn('BroadcastChannel not supported, using localStorage fallback')
      return
    }

    try {
      this.channel = new BroadcastChannel('openmeet_token_refresh')

      this.channel.onmessage = (event: MessageEvent<TokenRefreshMessage>) => {
        this.handleBroadcastMessage(event.data)
      }

      this.channel.onmessageerror = (error) => {
        logger.error('BroadcastChannel message error:', error)
      }

      logger.info('✅ BroadcastChannel initialized for cross-tab coordination')
    } catch (error) {
      logger.error('Failed to initialize BroadcastChannel:', error)
      this.channel = null
    }
  }

  private setupStorageEventListener (): void {
    // Listen for storage events from other tabs
    window.addEventListener('storage', (event) => {
      if (event.key === this.STORAGE_KEY && event.newValue) {
        try {
          const data: StorageCoordination = JSON.parse(event.newValue)

          // Convert storage coordination to message format
          const message: TokenRefreshMessage = {
            type: data.isRefreshing ? 'refresh_started'
              : (data.token ? 'tokens_updated' : 'refresh_completed'),
            timestamp: data.timestamp,
            tabId: data.tabId,
            token: data.token,
            refreshToken: data.refreshToken,
            tokenExpires: data.tokenExpires
          }

          this.handleBroadcastMessage(message)
        } catch (error) {
          logger.error('Failed to parse storage coordination data:', error)
        }
      }
    })
  }

  private cleanupStaleRefreshLocks (): void {
    // Skip in non-browser environments (e.g., tests)
    if (typeof localStorage === 'undefined') {
      return
    }

    // Check for stale locks on startup and periodically
    const checkAndCleanup = () => {
      // Guard against localStorage being unavailable (e.g., after test teardown)
      if (typeof localStorage === 'undefined') {
        return
      }
      const stored = localStorage.getItem(this.STORAGE_KEY)
      if (stored) {
        try {
          const data: StorageCoordination = JSON.parse(stored)
          const now = Date.now()

          // If refresh has been "in progress" for too long, clear it
          if (data.isRefreshing && (now - data.timestamp) > this.LOCK_TIMEOUT) {
            logger.warn(`Clearing stale refresh lock from tab ${data.tabId}`)
            localStorage.removeItem(this.STORAGE_KEY)
            this.broadcast({ type: 'refresh_failed', timestamp: now, tabId: data.tabId })
          }
        } catch (error) {
          logger.error('Failed to check stale locks:', error)
          localStorage.removeItem(this.STORAGE_KEY)
        }
      }
    }

    // Check immediately and then periodically
    checkAndCleanup()
    this.cleanupIntervalId = setInterval(checkAndCleanup, 5000) // Check every 5 seconds
  }

  private handleBroadcastMessage (message: TokenRefreshMessage): void {
    // Ignore our own messages
    if (message.tabId === this.tabId) {
      return
    }

    logger.debug(`📨 Tab ${this.tabId} received message:`, message.type, 'from', message.tabId)

    // Emit to local listeners
    const listeners = this.listeners.get(message.type)
    if (listeners) {
      listeners.forEach(listener => listener(message))
    }

    // Handle specific message types
    switch (message.type) {
      case 'refresh_started':
        // Another tab is refreshing, we should wait
        this.isRefreshing = true
        break

      case 'refresh_completed':
      case 'refresh_failed':
        // Refresh finished, we can proceed if needed
        this.isRefreshing = false
        this.refreshPromise = null
        break

      case 'tokens_updated':
        // New tokens available, update auth store immediately
        if (message.token && message.refreshToken) {
          logger.info('📱 New tokens received from another tab, updating store immediately')

          // Update auth store directly for immediate sync
          // Use skipStorage=true to avoid writing to localStorage (the refreshing tab already did)
          const authStore = useAuthStore()
          authStore.actionSetToken(message.token, true)
          authStore.actionSetRefreshToken(message.refreshToken, true)
          if (message.tokenExpires) {
            authStore.actionSetTokenExpires(message.tokenExpires, true)
          }
        }
        this.isRefreshing = false
        break
    }
  }

  private broadcast (message: TokenRefreshMessage): void {
    // Always include our tab ID
    message.tabId = this.tabId

    // Broadcast via BroadcastChannel if available
    if (this.channel) {
      try {
        this.channel.postMessage(message)
      } catch (error) {
        logger.error('Failed to broadcast message:', error)
      }
    }

    // Also use localStorage for browsers without BroadcastChannel
    // or as a fallback mechanism
    this.updateStorageCoordination(message)
  }

  private updateStorageCoordination (message: TokenRefreshMessage): void {
    const coordination: StorageCoordination = {
      isRefreshing: message.type === 'refresh_started',
      tabId: this.tabId,
      timestamp: message.timestamp,
      token: message.token,
      refreshToken: message.refreshToken,
      tokenExpires: message.tokenExpires
    }

    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(coordination))
    } catch (error) {
      logger.error('Failed to update storage coordination:', error)
    }
  }

  /**
   * Attempt to acquire the refresh lock
   * Returns true if lock acquired, false if another tab is refreshing
   */
  public async acquireRefreshLock (): Promise<boolean> {
    // Check if another tab is already refreshing
    const stored = localStorage.getItem(this.STORAGE_KEY)
    if (stored) {
      try {
        const data: StorageCoordination = JSON.parse(stored)
        const now = Date.now()

        // If another tab is refreshing and it's not stale
        if (data.isRefreshing && data.tabId !== this.tabId &&
            (now - data.timestamp) < this.LOCK_TIMEOUT) {
          logger.info(`🔒 Tab ${data.tabId} is already refreshing, waiting...`)
          return false
        }
      } catch (error) {
        logger.error('Failed to check refresh lock:', error)
      }
    }

    // Try to acquire the lock
    this.isRefreshing = true
    this.broadcast({
      type: 'refresh_started',
      timestamp: Date.now(),
      tabId: this.tabId
    })

    logger.info(`🔓 Tab ${this.tabId} acquired refresh lock`)
    return true
  }

  /**
   * Release the refresh lock and broadcast the result
   */
  public releaseRefreshLock (success: boolean, token?: string, refreshToken?: string, tokenExpires?: number): void {
    this.isRefreshing = false
    this.refreshPromise = null

    if (success && token && refreshToken) {
      // Broadcast the new tokens to other tabs
      this.broadcast({
        type: 'tokens_updated',
        timestamp: Date.now(),
        tabId: this.tabId,
        token,
        refreshToken,
        tokenExpires
      })
      logger.info(`✅ Tab ${this.tabId} completed refresh and shared tokens`)
    } else {
      this.broadcast({
        type: success ? 'refresh_completed' : 'refresh_failed',
        timestamp: Date.now(),
        tabId: this.tabId
      })
      logger.warn(`❌ Tab ${this.tabId} refresh ${success ? 'completed' : 'failed'}`)
    }

    // Clear the storage lock
    localStorage.removeItem(this.STORAGE_KEY)
  }

  /**
   * Check if any tab is currently refreshing
   */
  public isAnyTabRefreshing (): boolean {
    // Check our local state first
    if (this.isRefreshing) {
      return true
    }

    // Check storage for other tabs
    const stored = localStorage.getItem(this.STORAGE_KEY)
    if (stored) {
      try {
        const data: StorageCoordination = JSON.parse(stored)
        const now = Date.now()

        // Check if refresh is active and not stale
        return data.isRefreshing && (now - data.timestamp) < this.LOCK_TIMEOUT
      } catch (error) {
        logger.error('Failed to check refresh status:', error)
      }
    }

    return false
  }

  /**
   * Wait for any ongoing refresh to complete
   */
  public async waitForRefresh (timeout: number = 10000): Promise<boolean> {
    const startTime = Date.now()

    while (this.isAnyTabRefreshing()) {
      if (Date.now() - startTime > timeout) {
        logger.warn('Timeout waiting for token refresh')
        return false
      }

      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    return true
  }

  /**
   * Subscribe to cross-tab messages
   */
  public on (event: string, callback: (data: TokenRefreshMessage) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)
  }

  /**
   * Unsubscribe from cross-tab messages
   */
  public off (event: string, callback: (data: TokenRefreshMessage) => void): void {
    const listeners = this.listeners.get(event)
    if (listeners) {
      listeners.delete(callback)
    }
  }

  /**
   * Clean up resources
   */
  public destroy (): void {
    // Clear the cleanup interval
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId)
      this.cleanupIntervalId = null
    }

    if (this.channel) {
      this.channel.close()
      this.channel = null
    }
    this.listeners.clear()

    // Clear any locks held by this tab
    if (this.isRefreshing) {
      this.releaseRefreshLock(false)
    }
  }

  /**
   * Reset the singleton instance (useful for tests)
   */
  public static resetInstance (): void {
    if (CrossTabTokenService.instance) {
      CrossTabTokenService.instance.destroy()
      CrossTabTokenService.instance = null
    }
  }
}

// Export singleton instance getter
export const getCrossTabTokenService = () => CrossTabTokenService.getInstance()
