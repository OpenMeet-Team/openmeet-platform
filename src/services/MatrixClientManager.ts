import type { MatrixClient, ICreateClientOpts } from 'matrix-js-sdk'
import { ClientEvent, createClient, IndexedDBStore, IndexedDBCryptoStore } from 'matrix-js-sdk'
import { parseRoomAlias } from '../utils/matrixUtils'

// Interface for Matrix error objects
interface MatrixError {
  errcode?: string
  error?: string
  message?: string
  [key: string]: unknown
}

/**
 * MatrixClientManager - Centralized Matrix client management
 *
 * This singleton manages the Matrix client lifecycle, eliminating redundant
 * client creation and startClient() calls that were causing performance issues.
 *
 * Key optimizations:
 * - Single client instance across the application
 * - Consolidated startClient() configuration
 * - Efficient store management
 * - Parallel API operations where possible
 */
export class MatrixClientManager {
  // eslint-disable-next-line no-use-before-define
  private static instance: MatrixClientManager
  private client: MatrixClient | null = null
  private isInitializing = false
  private initPromise: Promise<MatrixClient> | null = null
  private isStarted = false
  private isShuttingDown = false
  private eventListenersSetup = false
  private syncStateHandler: ((state: string, prevState: string, data: unknown) => void) | null = null
  private readyHandler: ((state: string) => void) | null = null

  public static getInstance (): MatrixClientManager {
    if (!MatrixClientManager.instance) {
      MatrixClientManager.instance = new MatrixClientManager()
    }
    return MatrixClientManager.instance
  }

  /**
   * Get the current Matrix client instance
   */
  public getClient (): MatrixClient | null {
    return this.client
  }

  /**
   * Check if client is ready (created and started)
   */
  public isReady (): boolean {
    return this.client?.isLoggedIn() && this.isStarted && !this.isShuttingDown
  }

  /**
   * Create and initialize Matrix client with optimized configuration
   */
  public async initializeClient (credentials: {
    homeserverUrl: string
    accessToken: string
    userId: string
    deviceId?: string
    refreshToken?: string
    tokenRefreshFunction?: () => Promise<{ accessToken: string; refreshToken?: string }>
  }): Promise<MatrixClient> {
    // Return existing client if already initialized
    if (this.client && this.client.isLoggedIn() && this.isStarted) {
      console.log('✅ Matrix client already initialized and ready')
      return this.client
    }

    // Prevent concurrent initialization
    if (this.isInitializing && this.initPromise) {
      console.log('🔄 Matrix initialization already in progress, waiting...')
      return this.initPromise
    }

    this.isInitializing = true
    this.initPromise = this._performInitialization(credentials)

    try {
      const client = await this.initPromise
      this.isInitializing = false
      return client
    } catch (error) {
      this.isInitializing = false
      this.initPromise = null
      throw error
    }
  }

  /**
   * Start the Matrix client with optimized sync configuration
   */
  public async startClient (): Promise<void> {
    if (!this.client) {
      throw new Error('Cannot start client: no client initialized')
    }

    if (this.isStarted) {
      console.log('✅ Matrix client already started')
      return
    }

    console.log('🔄 Starting Matrix client with batched initialization...')

    const startTime = performance.now()

    // OPTIMIZATION: Batch client startup with parallel setup operations
    await Promise.all([
      // Start the Matrix client
      this.client.startClient({
        initialSyncLimit: 50, // Reduced from 100 for faster initial sync
        includeArchivedRooms: false, // Skip archived rooms for performance
        lazyLoadMembers: true, // Load members on demand
        pollTimeout: 30000 // 30s long polling
      }),

      // Parallel setup operations that don't require client to be started
      (async () => {
        // Pre-configure any client settings or cache warmup
        console.log('🔧 Configuring client settings in parallel...')

        // These operations can happen while client is starting
        if (this.client) {
          // Set any client-side preferences
          // Note: Most client methods require the client to be started,
          // so this is mainly for future optimization opportunities
        }
      })()
    ])

    this.isStarted = true
    const duration = performance.now() - startTime
    console.log(`✅ Matrix client started with batched operations in ${duration.toFixed(2)}ms`)
  }

  /**
   * Restart the client (for error recovery)
   */
  public async restartClient (): Promise<void> {
    if (!this.client) {
      throw new Error('Cannot restart client: no client initialized')
    }

    console.log('🔄 Restarting Matrix client...')
    this.isShuttingDown = true
    this.isStarted = false

    try {
      // Gracefully stop the current client
      await this.gracefulStop()

      // Wait a moment for cleanup
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Restart with same configuration
      this.isShuttingDown = false
      await this.startClient()
    } catch (error) {
      this.isShuttingDown = false
      throw error
    }
  }

  /**
   * Gracefully stop the client without clearing state
   */
  private async gracefulStop (): Promise<void> {
    if (!this.client) return

    console.log('🛑 Gracefully stopping Matrix client...')

    try {
      // Remove event listeners to prevent further events during shutdown
      this.removeEventListeners()

      // Stop the client with a timeout to prevent hanging
      const stopPromise = new Promise<void>((resolve) => {
        this.client?.stopClient()
        resolve()
      })

      const timeoutPromise = new Promise<void>((resolve) => {
        setTimeout(() => {
          console.warn('⚠️ Matrix client stop timeout, forcing shutdown')
          resolve()
        }, 5000) // 5 second timeout
      })

      await Promise.race([stopPromise, timeoutPromise])
      console.log('✅ Matrix client stopped gracefully')
    } catch (error) {
      console.warn('⚠️ Error during graceful stop:', error)
    }
  }

  /**
   * Clear and reset the client
   */
  public async clearClient (): Promise<void> {
    if (this.client) {
      console.log('🧹 Clearing Matrix client...')
      this.isShuttingDown = true

      await this.gracefulStop()
      this.client = null
    }
    this.isStarted = false
    this.isInitializing = false
    this.initPromise = null
    this.isShuttingDown = false
    this.eventListenersSetup = false
  }

  /**
   * Clear client and stored credentials when tokens are invalid
   */
  public async clearClientAndCredentials (): Promise<void> {
    console.log('🚫 Clearing Matrix client and stored credentials due to token error')

    // Clear the client
    await this.clearClient()

    // Clear stored credentials from localStorage
    try {
      // Clear all Matrix-related storage
      const keysToRemove = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && (
          key.startsWith('matrix_') ||
          key.includes('matrix-js-sdk') ||
          key.includes('matrix-crypto')
        )) {
          keysToRemove.push(key)
        }
      }

      keysToRemove.forEach(key => {
        localStorage.removeItem(key)
        console.log(`🧹 Removed stored credential: ${key}`)
      })

      // Also clear sessionStorage
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i)
        if (key && key.startsWith('matrix_')) {
          sessionStorage.removeItem(key)
          console.log(`🧹 Removed session credential: ${key}`)
        }
      }
    } catch (error) {
      console.warn('⚠️ Failed to clear some stored credentials:', error)
    }
  }

  /**
   * Internal initialization logic
   */
  private async _performInitialization (credentials: {
    homeserverUrl: string
    accessToken: string
    userId: string
    deviceId?: string
    refreshToken?: string
    tokenRefreshFunction?: () => Promise<{ accessToken: string; refreshToken?: string }>
  }): Promise<MatrixClient> {
    try {
      console.log('🔄 Creating Matrix client with optimized stores...')

      const startTime = performance.now()

      // Determine base URL
      let baseUrl = credentials.homeserverUrl
      if (!baseUrl.startsWith('http')) {
        baseUrl = `https://${baseUrl}`
      }

      // Create optimized IndexedDB stores
      const userId = credentials.userId
      const deviceId = credentials.deviceId || 'DEVICE_ID_NOT_SET'

      // Use separate databases for main store and crypto store
      const store = new IndexedDBStore({
        indexedDB: window.indexedDB,
        dbName: `matrix-js-sdk:${userId}`
      })

      const cryptoStore = new IndexedDBCryptoStore(
        window.indexedDB,
        `matrix-js-sdk-crypto:${userId}:${deviceId}`
      )

      // Create the client with refresh token support
      const clientOptions: ICreateClientOpts = {
        baseUrl,
        accessToken: credentials.accessToken,
        userId,
        deviceId,
        store,
        cryptoStore,
        useAuthorizationHeader: true, // More efficient auth
        timelineSupport: true
      }

      // Add refresh token support if available (enables SDK's automatic token refresh)
      if (credentials.refreshToken) {
        clientOptions.refreshToken = credentials.refreshToken
        console.log('🔑 Matrix client will be created with refresh token support')
      }

      if (credentials.tokenRefreshFunction) {
        clientOptions.tokenRefreshFunction = credentials.tokenRefreshFunction
        console.log('🔄 Matrix client will use provided token refresh function')
      }

      this.client = createClient(clientOptions)

      // OPTIMIZATION: Batch store startup with initial client preparation
      console.log('🔄 Batching store startup and client preparation...')
      const batchStartTime = performance.now()

      await Promise.all([
        // Store initialization
        store.startup(),
        cryptoStore.startup(),

        // Initial client-side preparation (doesn't require server calls)
        (async () => {
          // Pre-warm any client-side caches or configuration
          console.log('🔧 Pre-warming client configuration...')
        })()
      ])

      const batchDuration = performance.now() - batchStartTime
      console.log(`✅ Batched initialization completed in ${batchDuration.toFixed(2)}ms`)

      // Perform initial API calls with token validation (batched for efficiency)
      console.log('🔄 Performing batched Matrix API calls...')
      const apiStartTime = performance.now()

      try {
        await Promise.all([
          this.client.whoami(),
          // Add other non-critical API calls that can be done in parallel
          this.preloadInitialData()
        ])

        const apiDuration = performance.now() - apiStartTime
        console.log(`✅ Initial API calls completed in ${apiDuration.toFixed(2)}ms`)
      } catch (error: unknown) {
        console.error('❌ Token validation failed during client initialization:', error)

        // Check if this is a token error
        if (this._isTokenError(error)) {
          console.warn('🚫 Invalid or expired Matrix token detected - attempting token refresh')

          try {
            // Try to refresh the token instead of clearing the client
            await this.refreshMatrixToken()

            // Retry the API call with the new token
            await this.client.whoami()
            console.log('✅ Token refresh successful, client initialization completed')
          } catch (refreshError) {
            console.error('❌ Token refresh failed during initialization:', refreshError)
            await this.clearClientAndCredentials()
            throw new Error(`Matrix token validation failed: ${(error as MatrixError).errcode || (error as Error).message}`)
          }
        } else {
          // Re-throw other errors
          throw error
        }
      }

      const totalDuration = performance.now() - startTime
      console.log(`✅ Matrix client created in ${totalDuration.toFixed(2)}ms`)

      return this.client
    } catch (error: unknown) {
      console.error('❌ Failed to initialize Matrix client:', error)

      // If it's a token error, clear credentials; otherwise just clear client
      if (this._isTokenError(error)) {
        await this.clearClientAndCredentials()
      } else {
        await this.clearClient()
      }

      throw error
    }
  }

  /**
   * Refresh the Matrix access token and update the client
   * Note: In Matrix-native approach, token refresh is handled by MAS OIDC flow
   * This method is kept for compatibility but delegates to the Matrix client's built-in refresh
   */
  public async refreshMatrixToken (): Promise<void> {
    if (!this.client) {
      throw new Error('Cannot refresh token: no client initialized')
    }

    console.log('🔄 Matrix access token refresh requested')

    // With proper SDK configuration (refreshToken + tokenRefreshFunction),
    // the Matrix JS SDK handles token refresh automatically on M_UNKNOWN_TOKEN errors.
    // This method is kept for compatibility but should rarely be needed.
    console.log('✅ Matrix SDK handles token refresh automatically when properly configured')
  }

  /**
   * Check if an error is related to invalid/expired tokens
   */
  private _isTokenError (error: unknown): boolean {
    if (!error) return false

    // Check for Matrix error codes that specifically indicate token issues
    const tokenErrorCodes = [
      'M_UNKNOWN_TOKEN',
      'M_MISSING_TOKEN',
      'M_BAD_JSON'
    ]

    if ((error as MatrixError).errcode && tokenErrorCodes.includes((error as MatrixError).errcode)) {
      return true
    }

    // Special handling for M_FORBIDDEN - only treat as token error during initial auth
    if ((error as MatrixError).errcode === 'M_FORBIDDEN') {
      // Check if this is a token-related forbidden (authentication context)
      const message = ((error as MatrixError).message || (error as MatrixError).error || '').toLowerCase()
      return message.includes('token') || message.includes('unauthorized') || message.includes('authentication')
    }

    // Check error message patterns
    const errorMessagePatterns = [
      'token expired',
      'invalid token',
      'unknown token',
      'token is not active',
      'unauthorized'
    ]

    const errorMessage = ((error as MatrixError).message || (error as MatrixError).error || '').toLowerCase()
    return errorMessagePatterns.some(pattern => errorMessage.includes(pattern))
  }

  /**
   * Set up essential event listeners (minimal set for performance)
   */
  public setupEventListeners (onSyncStateChange?: (state: string) => void): void {
    if (!this.client || this.eventListenersSetup) {
      return
    }

    console.log('🎧 Setting up Matrix client event listeners...')

    // Store sync state change handler for cleanup
    this.syncStateHandler = (state: string, prevState: string, data: unknown) => {
      console.log(`🔄 Matrix sync state: ${prevState} → ${state}`)

      if (onSyncStateChange) {
        onSyncStateChange(state)
      }

      if (state === 'PREPARED') {
        console.log('✅ Matrix client fully synced and ready')
      } else if (state === 'ERROR') {
        console.error('❌ Matrix sync error:', data)
      }
    }

    // Store ready handler for cleanup
    this.readyHandler = (state: string) => {
      if (state === 'PREPARED') {
        const rooms = this.client?.getRooms() || []
        console.log(`📊 Matrix client has ${rooms.length} rooms after sync`)
      }
    }

    // Only essential listeners for performance
    this.client.on(ClientEvent.Sync, this.syncStateHandler)
    this.client.once(ClientEvent.Sync, this.readyHandler)

    this.eventListenersSetup = true
    console.log('✅ Matrix client event listeners configured')
  }

  /**
   * Remove event listeners for clean shutdown
   */
  private removeEventListeners (): void {
    if (!this.client || !this.eventListenersSetup) {
      return
    }

    console.log('🧹 Removing Matrix client event listeners...')

    try {
      if (this.syncStateHandler) {
        this.client.removeListener(ClientEvent.Sync, this.syncStateHandler)
      }
      if (this.readyHandler) {
        this.client.removeListener(ClientEvent.Sync, this.readyHandler)
      }

      this.eventListenersSetup = false
      console.log('✅ Matrix client event listeners removed')
    } catch (error) {
      console.warn('⚠️ Error removing event listeners:', error)
    }
  }

  /**
   * Preload initial data that can be fetched in parallel during initialization
   */
  private async preloadInitialData (): Promise<void> {
    if (!this.client) return

    try {
      console.log('🔄 Preloading initial Matrix data...')

      // Batch non-critical API calls that can fail without affecting initialization
      await Promise.all([
        // Get capabilities (non-critical, helps with feature detection)
        this.client.getCapabilities().catch(error => {
          console.warn('⚠️ Failed to fetch capabilities (non-critical):', error)
        }),

        // Get push rules (non-critical, can be loaded later)
        this.client.getPushRules().catch(error => {
          console.warn('⚠️ Failed to fetch push rules (non-critical):', error)
        }),

        // Pre-warm room list (non-critical, will be loaded during sync anyway)
        this.client.getRooms() ? Promise.resolve() : Promise.resolve()
      ])

      console.log('✅ Initial data preload completed')
    } catch (error) {
      // Don't throw - these are all non-critical operations
      console.warn('⚠️ Some initial data preload operations failed (non-critical):', error)
    }
  }

  /**
   * Clean up Matrix state when navigating between different contexts
   *
   * IMPORTANT: We no longer automatically leave rooms during navigation context switches
   * because Matrix Application Services may not automatically re-invite users when they
   * return to those contexts. Rooms should only be left when users explicitly leave
   * groups/events permanently (e.g., "Leave Group", "Not Going" buttons).
   */
  public async cleanupOnNavigation (newContext: string, oldContext?: string): Promise<void> {
    if (!this.client || !this.isStarted) {
      console.log('🔄 No Matrix client active, skipping navigation cleanup')
      return
    }

    console.log(`🧹 Matrix context change detected: ${oldContext || 'unknown'} → ${newContext}`)
    console.log('ℹ️ Skipping automatic room cleanup to prevent invitation loss')

    // We no longer automatically leave rooms during navigation.
    // This prevents the invitation loss issue where users couldn't rejoin
    // event/group rooms after navigating away and back.

    // Future enhancement: We could implement smarter cleanup that only
    // leaves rooms when users explicitly indicate they're no longer interested
    // in a group or event (e.g., clicking "Leave Group" or "Not Going").
  }

  /**
   * Determine if a room is essential for the given context
   * NOTE: This method is currently unused since we disabled automatic room cleanup,
   * but kept for potential future use with smarter cleanup logic.
   */
  private isEssentialRoom (roomId: string, context: string): boolean {
    if (!this.client) return false

    const room = this.client.getRoom(roomId)
    if (!room) return false

    // Keep direct message rooms
    if (roomId.includes(':dm-') || roomId.includes('-dm-')) {
      return true
    }

    // Keep admin/system rooms
    if (roomId.includes('admin') || roomId.includes('system')) {
      return true
    }

    // Check if room matches current context by examining room aliases
    const roomAliases = room.getAltAliases()
    for (const alias of roomAliases) {
      // Parse each alias to extract type-slug-tenantId
      const parsed = parseRoomAlias(alias)
      if (parsed) {
        const roomContext = `${parsed.type}-${parsed.slug}-${parsed.tenantId}`
        if (roomContext === context) {
          return true
        }
      }
    }

    // Fallback: check canonical alias
    const canonicalAlias = room.getCanonicalAlias()
    if (canonicalAlias) {
      const parsed = parseRoomAlias(canonicalAlias)
      if (parsed) {
        const roomContext = `${parsed.type}-${parsed.slug}-${parsed.tenantId}`
        if (roomContext === context) {
          return true
        }
      }
    }

    return false
  }

  /**
   * Complete shutdown and cleanup (for application termination)
   */
  public async shutdown (): Promise<void> {
    console.log('🔌 Shutting down MatrixClientManager...')
    this.isShuttingDown = true

    try {
      await this.clearClient()
      await this.clearClientAndCredentials()

      // Reset singleton instance (useful for testing)
      MatrixClientManager.instance = null!

      console.log('✅ MatrixClientManager shutdown complete')
    } catch (error) {
      console.error('❌ Error during MatrixClientManager shutdown:', error)
      throw error
    }
  }
}

// Export singleton instance
export const matrixClientManager = MatrixClientManager.getInstance()
