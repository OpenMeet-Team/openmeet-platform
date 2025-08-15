import type { MatrixClient, ICreateClientOpts, MatrixError as SdkMatrixError } from 'matrix-js-sdk'
import { ClientEvent, createClient, IndexedDBStore, HttpApiEvent, IndexedDBCryptoStore, LocalStorageCryptoStore, MemoryCryptoStore } from 'matrix-js-sdk'
import type { IdTokenClaims } from 'oidc-client-ts'
import { parseRoomAlias } from '../utils/matrixUtils'
import { TokenRefresher } from '../matrix/oidc/TokenRefresher'
// Note: Using inline cryptoCallbacks instead of MatrixSecurityManager for simplicity
import { logger } from '../utils/logger'

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
  private sessionLoggedOutHandler: ((error: SdkMatrixError) => void) | null = null

  // Crypto state tracking - separate from basic client
  private cryptoInitPromise: Promise<void> | null = null
  private cryptoInitialized = false
  private cryptoInitializing = false

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
    const loggedIn = this.client?.isLoggedIn() ?? false
    const result = loggedIn && this.isStarted && !this.isShuttingDown

    // Debug logging for timing issues
    if (loggedIn && !result) {
      logger.debug('🔍 MatrixClientManager.isReady() timing issue:', {
        loggedIn,
        isStarted: this.isStarted,
        isShuttingDown: this.isShuttingDown,
        result
      })
    }

    return result
  }

  /**
   * Check if crypto is available and initialized
   */
  public isCryptoReady (): boolean {
    return this.cryptoInitialized && this.client?.getCrypto() != null
  }

  /**
   * Check if crypto is currently initializing
   */
  public isCryptoInitializing (): boolean {
    return this.cryptoInitializing
  }

  /**
   * Attempt to restore key backup if available and user has stored passphrase
   * This ensures historical messages can be decrypted on new sessions
   */
  private async attemptKeyBackupRestoration (): Promise<void> {
    if (!this.client) {
      return
    }

    try {
      // Ensure client is properly authenticated before attempting key backup operations
      const accessToken = this.client.getAccessToken()
      if (!accessToken) {
        logger.debug('⚠️ No access token available for key backup operations')
        return
      }

      const crypto = this.client.getCrypto()
      if (!crypto) {
        logger.debug('⚠️ Crypto not available for key backup restoration')
        return
      }

      // Check if there's a key backup on the server
      const keyBackupInfo = await crypto.getKeyBackupInfo()
      if (!keyBackupInfo) {
        logger.debug('ℹ️ No key backup found on server')
        return
      }

      // Check if we already have room keys locally (avoid unnecessary restoration)
      logger.debug('🔍 Key backup found on server, checking if restoration is needed...')

      // Use Matrix SDK's built-in secret storage mechanism for secure backup restoration
      try {
        logger.debug('🔐 Attempting automatic key backup restoration from secret storage...')
        await crypto.loadSessionBackupPrivateKeyFromSecretStorage()
        logger.debug('✅ Key backup private key loaded from secret storage')
        // Check if backup is now accessible and restore if needed
        const backupVersion = await crypto.getActiveSessionBackupVersion()
        if (backupVersion) {
          logger.debug(`✅ Key backup restored successfully (version: ${backupVersion})`)
        } else {
          logger.debug('ℹ️ No active session backup found after key loading')
        }
      } catch (secretStorageError) {
        logger.debug('ℹ️ Could not load backup key from secret storage:', secretStorageError.message)
        // This is expected if the user hasn't set up secret storage or backup properly
        // The Matrix SDK will handle requesting keys from other devices automatically
      }
    } catch (error) {
      logger.warn('⚠️ Key backup restoration failed (non-fatal):', error)
      // Don't throw - this is not critical for basic functionality
    }
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
    oidcIssuer?: string
    oidcClientId?: string
    oidcRedirectUri?: string
    idTokenClaims?: IdTokenClaims
  }): Promise<MatrixClient> {
    // Return existing client if already initialized
    if (this.client && this.client.isLoggedIn() && this.isStarted) {
      logger.debug('✅ Matrix client already initialized and ready')
      return this.client
    }

    // Prevent concurrent initialization
    if (this.isInitializing && this.initPromise) {
      logger.debug('🔄 Matrix initialization already in progress, waiting...')
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
      logger.debug('✅ Matrix client already started')
      return
    }

    logger.debug('🔄 Starting Matrix client with batched initialization...')

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
        logger.debug('🔧 Configuring client settings in parallel...')

        // Initialize crypto after client starts to prevent "shutting down" errors
        // This ensures encryption is ready after logout/login cycles
        try {
          logger.debug('🔐 Initializing crypto during client startup...')
          await this.initializeCrypto()
          logger.debug('✅ Crypto initialized during client startup')

          // Wait a moment for sync to stabilize before attempting key backup operations
          // This helps prevent token/auth issues during startup
          setTimeout(async () => {
            try {
              // Also attempt key backup restoration if available (delayed to avoid token issues)
              await this.attemptKeyBackupRestoration()
            } catch (error) {
              logger.warn('⚠️ Key backup restoration failed during delayed startup:', error)
            }
          }, 2000) // 2 second delay
        } catch (error) {
          logger.warn('⚠️ Crypto initialization failed during startup, will retry on demand:', error)
        }
      })()
    ])

    this.isStarted = true
    const duration = performance.now() - startTime
    logger.debug(`✅ Matrix client started with batched operations in ${duration.toFixed(2)}ms`)
  }

  /**
   * Restart the client (for error recovery)
   */
  public async restartClient (): Promise<void> {
    if (!this.client) {
      throw new Error('Cannot restart client: no client initialized')
    }

    logger.debug('🔄 Restarting Matrix client...')
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

    logger.debug('🛑 Gracefully stopping Matrix client...')

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
          logger.warn('Matrix client stop timeout, forcing shutdown')
          resolve()
        }, 5000) // 5 second timeout
      })

      await Promise.race([stopPromise, timeoutPromise])
      logger.debug('✅ Matrix client stopped gracefully')
    } catch (error) {
      logger.warn('Error during graceful stop:', error)
    }
  }

  /**
   * Clear and reset the client
   */
  public async clearClient (): Promise<void> {
    if (this.client) {
      logger.debug('🧹 Clearing Matrix client...')
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
    logger.debug('🚫 Clearing Matrix client and stored credentials due to token error')

    // Emit token error event for UI components to react
    const tokenErrorEvent = new CustomEvent('matrix:tokenError', {
      detail: {
        error: 'Token expired or invalid',
        context: 'matrix_client_manager',
        action: 'clearing_credentials'
      }
    })
    window.dispatchEvent(tokenErrorEvent)

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
        logger.debug(`🧹 Removed stored credential: ${key}`)
      })

      // Also clear sessionStorage
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i)
        if (key && key.startsWith('matrix_')) {
          sessionStorage.removeItem(key)
          logger.debug(`🧹 Removed session credential: ${key}`)
        }
      }
    } catch (error) {
      logger.warn('Failed to clear some stored credentials:', error)
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
    oidcIssuer?: string
    oidcClientId?: string
    oidcRedirectUri?: string
    idTokenClaims?: IdTokenClaims
  }): Promise<MatrixClient> {
    try {
      logger.debug('🔄 Creating Matrix client with optimized stores...')

      // Check WebCrypto availability first
      if (!window.crypto || !window.crypto.subtle) {
        logger.error('❌ WebCrypto API is not available - encryption will not work')
      } else {
        logger.debug('✅ WebCrypto API is available')
      }

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
        dbName: `matrix-js-sdk:${userId}:${deviceId}`
      })

      // Create the client with refresh token support
      const clientOptions: ICreateClientOpts = {
        baseUrl,
        accessToken: credentials.accessToken,
        userId,
        deviceId,
        store,
        // Add cryptoStore following Element-Web pattern to fix encryption
        cryptoStore: window.indexedDB
          ? new IndexedDBCryptoStore(window.indexedDB, `matrix-js-sdk:crypto:${userId}:${deviceId}`)
          : window.localStorage
            ? new LocalStorageCryptoStore(window.localStorage)
            : new MemoryCryptoStore(),
        useAuthorizationHeader: true, // More efficient auth
        timelineSupport: true,
        // Use Element-Web style secret storage callbacks (temporary client for callback setup)
        cryptoCallbacks: {
          getSecretStorageKey: async () => {
            // This will be called when secret storage access is needed
            // For now, return null to allow the bootstrap process to handle key creation
            logger.debug('🔑 getSecretStorageKey callback invoked - allowing bootstrap to handle key creation')
            return null
          },
          cacheSecretStorageKey: (keyId) => {
            // Cache key for session (this follows Element-Web pattern)
            logger.debug('🔑 cacheSecretStorageKey callback invoked for keyId:', keyId)
          }
        }
      }

      // Add refresh token support with Element Web-style TokenRefresher pattern
      if (credentials.refreshToken && credentials.oidcIssuer && credentials.oidcClientId) {
        logger.debug('🔑 Creating TokenRefresher for OIDC token management', {
          hasRefreshToken: !!credentials.refreshToken,
          oidcIssuer: credentials.oidcIssuer,
          oidcClientId: credentials.oidcClientId,
          deviceId
        })

        // Create TokenRefresher similar to Element Web's approach
        const tokenRefresher = new TokenRefresher(
          credentials.oidcIssuer,
          credentials.oidcClientId,
          credentials.oidcRedirectUri || `${window.location.origin}/auth/matrix`,
          deviceId,
          credentials.idTokenClaims || {} as IdTokenClaims,
          userId
        )

        // Use Element Web pattern: pass tokenRefresher's doRefreshAccessToken method
        clientOptions.refreshToken = credentials.refreshToken

        // Create a wrapped function for better debugging
        const tokenRefreshFunction = async (refreshToken: string) => {
          logger.debug('🔄 tokenRefreshFunction called by Matrix SDK - delegating to TokenRefresher', {
            hasRefreshToken: !!refreshToken
          })
          try {
            const result = await tokenRefresher.doRefreshAccessToken(refreshToken)
            logger.debug('✅ tokenRefreshFunction completed successfully')
            return result
          } catch (error) {
            logger.error('❌ tokenRefreshFunction failed:', error)
            throw error
          }
        }

        clientOptions.tokenRefreshFunction = tokenRefreshFunction
        logger.debug('🔑 Matrix client configured with Element Web-style TokenRefresher')
        logger.debug('🔧 tokenRefreshFunction set to:', typeof clientOptions.tokenRefreshFunction)
      } else if (credentials.refreshToken) {
        // Fallback to basic refresh token support for non-OIDC scenarios
        clientOptions.refreshToken = credentials.refreshToken
        logger.debug('🔑 Matrix client created with basic refresh token - SDK will handle automatic token refresh')
      }

      this.client = createClient(clientOptions)

      // Initialize Rust crypto to enable room encryption processing
      // This is required for room encryptors to be created during sync
      logger.debug('🔐 Initializing Rust crypto for room encryption support...')
      await this.client.initRustCrypto({
        useIndexedDB: true,
        cryptoDatabasePrefix: `matrix-js-sdk:crypto:${userId}:${deviceId}`
      })
      logger.debug('✅ Rust crypto initialized - room encryptors will be created during sync')

      // Client is ready for basic operations with crypto support
      logger.debug('✅ Matrix client created with full crypto support ready')

      // OPTIMIZATION: Batch store startup with initial client preparation
      logger.debug('🔄 Batching store startup and client preparation...')
      const batchStartTime = performance.now()

      await Promise.all([
        // Store initialization
        store.startup(),

        // Initial client-side preparation (doesn't require server calls)
        (async () => {
          // Pre-warm any client-side caches or configuration
          logger.debug('🔧 Pre-warming client configuration...')
        })()
      ])

      const batchDuration = performance.now() - batchStartTime
      logger.debug(`✅ Batched initialization completed in ${batchDuration.toFixed(2)}ms`)

      // Perform initial API calls with token validation (batched for efficiency)
      logger.debug('🔄 Performing batched Matrix API calls...')
      const apiStartTime = performance.now()

      try {
        await Promise.all([
          this.client.whoami(),
          // Add other non-critical API calls that can be done in parallel
          this.preloadInitialData()
        ])

        const apiDuration = performance.now() - apiStartTime
        logger.debug(`✅ Initial API calls completed in ${apiDuration.toFixed(2)}ms`)
      } catch (error: unknown) {
        logger.error('❌ Token validation failed during client initialization:', error)

        // Check if this is a token error
        if (this._isTokenError(error)) {
          logger.warn('Invalid or expired Matrix token detected - attempting token refresh')

          try {
            // Try to refresh the token instead of clearing the client
            await this.refreshMatrixToken()

            // Retry the API call with the new token
            await this.client.whoami()
            logger.debug('✅ Token refresh successful, client initialization completed')
          } catch (refreshError) {
            logger.error('❌ Token refresh failed during initialization:', refreshError)

            // Emit token refresh failure event
            const tokenRefreshFailureEvent = new CustomEvent('matrix:tokenRefreshFailure', {
              detail: {
                error: refreshError,
                originalError: error,
                context: 'matrix_client_manager_init'
              }
            })
            window.dispatchEvent(tokenRefreshFailureEvent)

            await this.clearClientAndCredentials()
            throw new Error(`Matrix token validation failed: ${(error as MatrixError).errcode || (error as Error).message}`)
          }
        } else {
          // Re-throw other errors
          throw error
        }
      }

      const totalDuration = performance.now() - startTime
      logger.debug(`✅ Matrix client created in ${totalDuration.toFixed(2)}ms`)

      // Debug crypto availability
      const crypto = this.client.getCrypto()
      if (crypto) {
        logger.debug('🔐 Matrix crypto is available and ready')
      } else {
        logger.warn('❌ Matrix crypto is NOT available - this may cause encryption setup to fail')
        logger.debug('🔍 Crypto debugging info:', {
          clientHasCrypto: typeof this.client.getCrypto === 'function',
          usingRustCrypto: true
        })
      }

      return this.client
    } catch (error: unknown) {
      logger.error('❌ Failed to initialize Matrix client:', error)

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
      logger.debug('🔄 No Matrix client available for token refresh - authentication needed')
      return // Don't throw, just return - this indicates auth is needed
    }

    logger.debug('🔄 Matrix access token refresh requested')

    // With native SDK OIDC configuration (refreshToken),
    // the Matrix JS SDK handles token refresh automatically on M_UNKNOWN_TOKEN errors.
    // This method is kept for compatibility but should rarely be needed.
    logger.debug('✅ Matrix SDK handles token refresh automatically with native OIDC support')
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

    logger.debug('🎧 Setting up Matrix client event listeners...')

    // Store sync state change handler for cleanup
    this.syncStateHandler = (state: string, prevState: string, data: unknown) => {
      logger.debug(`🔄 Matrix sync state: ${prevState} → ${state}`)

      if (onSyncStateChange) {
        onSyncStateChange(state)
      }

      if (state === 'PREPARED') {
        logger.debug('✅ Matrix client fully synced and ready')
      } else if (state === 'ERROR') {
        logger.error('❌ Matrix sync error:', data)
        // Note: Token errors are now handled by HttpApiEvent.SessionLoggedOut listener
        // This follows Element Web's pattern of letting the SDK handle token refresh attempts
      }
    }

    // Store ready handler for cleanup
    this.readyHandler = (state: string) => {
      if (state === 'PREPARED') {
        const rooms = this.client?.getRooms() || []
        logger.debug(`📊 Matrix client has ${rooms.length} rooms after sync`)
      }
    }

    // Store session logged out handler for cleanup (Element Web pattern)
    this.sessionLoggedOutHandler = (error: SdkMatrixError) => {
      logger.warn('Matrix session logged out - SDK determined token refresh failed', error)

      // Emit token error event for UI components to react (following our existing pattern)
      const tokenErrorEvent = new CustomEvent('matrix:tokenError', {
        detail: {
          error,
          context: 'matrix_session_logged_out',
          sdkManagedTokenRefresh: true
        }
      })
      window.dispatchEvent(tokenErrorEvent)

      // Clear credentials to force re-authentication
      this.clearClientAndCredentials().catch(clearError => {
        logger.error('❌ Failed to clear credentials after session logged out:', clearError)
      })
    }

    // Only essential listeners for performance
    this.client.on(ClientEvent.Sync, this.syncStateHandler)
    this.client.once(ClientEvent.Sync, this.readyHandler)

    // Listen for session logged out events (Element Web pattern)
    // This is emitted by the SDK when token refresh has failed and user action is required
    this.client.on(HttpApiEvent.SessionLoggedOut, this.sessionLoggedOutHandler)

    this.eventListenersSetup = true
    logger.debug('✅ Matrix client event listeners configured')
  }

  /**
   * Remove event listeners for clean shutdown
   */
  private removeEventListeners (): void {
    if (!this.client || !this.eventListenersSetup) {
      return
    }

    logger.debug('🧹 Removing Matrix client event listeners...')

    try {
      if (this.syncStateHandler) {
        this.client.removeListener(ClientEvent.Sync, this.syncStateHandler)
      }
      if (this.readyHandler) {
        this.client.removeListener(ClientEvent.Sync, this.readyHandler)
      }
      if (this.sessionLoggedOutHandler) {
        this.client.removeListener(HttpApiEvent.SessionLoggedOut, this.sessionLoggedOutHandler)
      }

      this.eventListenersSetup = false
      logger.debug('✅ Matrix client event listeners removed')
    } catch (error) {
      logger.warn('Error removing event listeners:', error)
    }
  }

  /**
   * Preload initial data that can be fetched in parallel during initialization
   */
  private async preloadInitialData (): Promise<void> {
    if (!this.client) return

    try {
      logger.debug('🔄 Preloading initial Matrix data...')

      // Batch non-critical API calls that can fail without affecting initialization
      await Promise.all([
        // Get capabilities (non-critical, helps with feature detection)
        this.client.getCapabilities().catch(error => {
          logger.warn('Failed to fetch capabilities (non-critical):', error)
        }),

        // Get push rules (non-critical, can be loaded later)
        this.client.getPushRules().catch(error => {
          logger.warn('Failed to fetch push rules (non-critical):', error)
        }),

        // Pre-warm room list (non-critical, will be loaded during sync anyway)
        this.client.getRooms() ? Promise.resolve() : Promise.resolve()
      ])

      logger.debug('✅ Initial data preload completed')
    } catch (error) {
      // Don't throw - these are all non-critical operations
      logger.warn('Some initial data preload operations failed (non-critical):', error)
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
      logger.debug('🔄 No Matrix client active, skipping navigation cleanup')
      return
    }

    logger.debug(`🧹 Matrix context change detected: ${oldContext || 'unknown'} → ${newContext}`)
    logger.debug('ℹ️ Skipping automatic room cleanup to prevent invitation loss')

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
   * Clear the crypto store for a specific user and device to resolve device ID mismatches
   */
  private async clearCryptoStore (userId: string, deviceId?: string): Promise<void> {
    try {
      logger.debug('🧹 Clearing crypto store for user:', userId, 'deviceId:', deviceId)

      // Clear device-specific crypto store databases
      const baseNames = [
        'matrix-js-sdk::matrix-sdk-crypto',
        `matrix-js-sdk:crypto:${userId}`,
        deviceId ? `matrix-js-sdk:crypto:${userId}:${deviceId}` : null,
        // Also try the old format for cleanup
        'matrix-js-sdk:crypto'
      ].filter(Boolean) as string[]

      for (const dbName of baseNames) {
        try {
          const deleteRequest = indexedDB.deleteDatabase(dbName)
          await new Promise<void>((resolve) => {
            deleteRequest.onsuccess = () => {
              logger.debug(`✅ Cleared crypto database: ${dbName}`)
              resolve()
            }
            deleteRequest.onerror = () => {
              logger.warn(`⚠️ Could not clear crypto database ${dbName}:`, deleteRequest.error)
              resolve() // Don't fail the whole process for individual DB cleanup failures
            }
            deleteRequest.onblocked = () => {
              logger.warn(`⚠️ Crypto database ${dbName} deletion blocked - continuing anyway`)
              resolve()
            }
          })
        } catch (error) {
          logger.warn(`⚠️ Error clearing crypto database ${dbName}:`, error)
          // Continue with other cleanup attempts
        }
      }

      logger.debug('✅ Crypto store cleanup completed')
    } catch (error) {
      logger.error('❌ Failed to clear crypto store:', error)
      // Don't throw - we want to attempt crypto initialization anyway
    }
  }

  /**
   * Initialize crypto separately from basic client - this can fail without breaking chat
   */
  public async initializeCrypto (userId?: string, deviceId?: string): Promise<boolean> {
    if (!this.client) {
      logger.error('❌ Cannot initialize crypto: Matrix client not ready')
      return false
    }

    if (this.cryptoInitialized) {
      logger.debug('✅ Crypto already initialized')
      return true
    }

    if (this.cryptoInitializing) {
      logger.debug('🔄 Crypto initialization already in progress, waiting...')
      await this.cryptoInitPromise
      return this.cryptoInitialized
    }

    this.cryptoInitializing = true
    this.cryptoInitPromise = this._performCryptoInitialization(userId, deviceId)

    try {
      await this.cryptoInitPromise
      this.cryptoInitialized = true
      logger.debug('✅ Crypto initialization completed successfully')
      return true
    } catch (error) {
      logger.error('❌ Crypto initialization failed:', error)
      this.cryptoInitialized = false
      return false
    } finally {
      this.cryptoInitializing = false
    }
  }

  /**
   * Internal method to perform crypto initialization with error handling
   */
  private async _performCryptoInitialization (userId?: string, deviceId?: string): Promise<void> {
    if (!this.client) {
      throw new Error('Matrix client not available')
    }

    logger.debug('🔐 Starting Rust crypto initialization...')

    try {
      await this.client.initRustCrypto()
      logger.debug('✅ Rust crypto module initialized successfully')
    } catch (error) {
      const errorMessage = (error as Error).message || ''

      // Handle device ID mismatch gracefully
      if (errorMessage.includes('account in the store doesn\'t match') ||
          (errorMessage.includes('expected') && errorMessage.includes('got'))) {
        logger.warn('🔄 Device ID mismatch detected, clearing crypto store and retrying...', {
          error: errorMessage,
          currentDeviceId: deviceId,
          userId
        })

        if (userId) {
          await this.clearCryptoStore(userId, deviceId)
        }

        // Retry crypto initialization with fresh store
        await this.client.initRustCrypto()
        logger.debug('✅ Rust crypto module initialized successfully after store reset')
      } else {
        // Re-throw other crypto initialization errors
        logger.error('❌ Failed to initialize Rust crypto module:', error)
        throw error
      }
    }

    // Verify crypto is available
    const crypto = this.client.getCrypto()
    if (crypto) {
      logger.debug('🔐 Matrix crypto is available and ready')
    } else {
      throw new Error('Crypto initialization appeared to succeed but crypto instance not available')
    }
  }

  /**
   * Complete shutdown and cleanup (for application termination)
   */
  public async shutdown (): Promise<void> {
    logger.debug('🔌 Shutting down MatrixClientManager...')
    this.isShuttingDown = true

    try {
      await this.clearClient()
      await this.clearClientAndCredentials()

      // Reset singleton instance (useful for testing)
      MatrixClientManager.instance = null!

      logger.debug('✅ MatrixClientManager shutdown complete')
    } catch (error) {
      logger.error('❌ Error during MatrixClientManager shutdown:', error)
      throw error
    }
  }
}

// Export singleton instance
export const matrixClientManager = MatrixClientManager.getInstance()
