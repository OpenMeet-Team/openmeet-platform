import type { MatrixClient, ICreateClientOpts, MatrixError as SdkMatrixError } from 'matrix-js-sdk'
import { ClientEvent, createClient, IndexedDBStore, HttpApiEvent, IndexedDBCryptoStore, LocalStorageCryptoStore, MemoryCryptoStore } from 'matrix-js-sdk'
import { CryptoEvent } from 'matrix-js-sdk/lib/crypto-api'
import type { IdTokenClaims } from 'oidc-client-ts'
import { parseRoomAlias } from '../utils/matrixUtils'
import { TokenRefresher } from '../matrix/oidc/TokenRefresher'
// Note: Using inline cryptoCallbacks instead of MatrixSecurityManager for simplicity
import { logger } from '../utils/logger'
import { Dialog, Notify } from 'quasar'

// Type definitions for secret storage
interface SecretStorageKeyInfo {
  passphrase?: {
    salt: string
    iterations: number
  }
  algorithm?: string
}

/**
 * Derive a secret storage key from passphrase using PBKDF2
 * Following Element Web's key derivation pattern
 */
async function deriveKeyFromPassphrase (passphrase: string, keyInfo: SecretStorageKeyInfo): Promise<Uint8Array> {
  const saltBytes = new Uint8Array(keyInfo.passphrase?.salt ? atob(keyInfo.passphrase.salt).split('').map(c => c.charCodeAt(0)) : [])
  const iterations = keyInfo.passphrase?.iterations || 500000

  const encoder = new TextEncoder()
  const passphraseBytes = encoder.encode(passphrase)

  // Import passphrase as a key
  const baseKey = await crypto.subtle.importKey(
    'raw',
    passphraseBytes,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  )

  // Derive key using PBKDF2
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations,
      hash: 'SHA-512'
    },
    baseKey,
    256 // 32 bytes
  )

  return new Uint8Array(derivedBits)
}

/**
 * Prompt user for secret storage passphrase using mobile-friendly Quasar dialog
 * Following Element Web's AccessSecretStorageDialog pattern
 */
async function promptForSecretStoragePassphrase (keyInfo: SecretStorageKeyInfo): Promise<Uint8Array | null> {
  return new Promise((resolve) => {
    Dialog.create({
      title: 'Security Key Required',
      message: 'Please enter your security passphrase to unlock encrypted messaging:',
      prompt: {
        model: '',
        type: 'password',
        placeholder: 'Security passphrase'
      },
      persistent: true,
      ok: {
        label: 'Unlock',
        color: 'primary'
      },
      cancel: {
        label: 'Cancel',
        color: 'grey'
      }
    }).onOk(async (passphrase: string) => {
      try {
        if (!passphrase.trim()) {
          Notify.create({
            type: 'negative',
            message: 'Please enter your passphrase'
          })
          resolve(null)
          return
        }

        logger.debug('🔑 Deriving secret storage key from passphrase')
        const derivedKey = await deriveKeyFromPassphrase(passphrase, keyInfo)

        logger.debug('✅ Secret storage key derived successfully')
        resolve(derivedKey)
      } catch (error) {
        logger.error('❌ Failed to derive secret storage key:', error)
        Notify.create({
          type: 'negative',
          message: 'Invalid passphrase or key derivation failed',
          caption: 'Please check your passphrase and try again'
        })
        resolve(null)
      }
    }).onCancel(() => {
      logger.debug('🚫 User cancelled secret storage passphrase prompt')
      resolve(null)
    })
  })
}

// Element Web-style secret storage cache (similar to SecurityManager.ts)
// This stores the secret storage private keys in memory for the JS SDK. This is
// only meant to act as a cache to avoid prompting the user multiple times
// during the same single operation.
let secretStorageKeys: Record<string, Uint8Array> = {}
let secretStorageKeyInfo: Record<string, unknown> = {}
let secretStorageBeingAccessed = false

// Export functions for MatrixEncryptionService to use
export function setSecretStorageBeingAccessed (accessing: boolean): void {
  secretStorageBeingAccessed = accessing
}

export function cacheSecretStorageKeyForBootstrap (keyId: string, keyInfo: unknown, key: Uint8Array): void {
  logger.debug(`🔑 Caching secret storage key for bootstrap: ${keyId}`)
  secretStorageKeys[keyId] = key
  secretStorageKeyInfo[keyId] = keyInfo
}

export function clearSecretStorageCache (): void {
  secretStorageKeys = {}
  secretStorageKeyInfo = {}
  logger.debug('🗑️ Secret storage cache cleared')
}

/**
 * Element Web's withSecretStorageKeyCache pattern
 * Carry out an operation that may require multiple accesses to secret storage, caching the key.
 */
export async function withSecretStorageKeyCache<T> (func: () => Promise<T>): Promise<T> {
  logger.debug('🔑 Enabling secret storage key cache')
  secretStorageBeingAccessed = true
  try {
    return await func()
  } finally {
    // Clear secret storage key cache now that work is complete
    logger.debug('🧹 Clearing secret storage key cache')
    secretStorageBeingAccessed = false
    secretStorageKeys = {}
    secretStorageKeyInfo = {}
  }
}

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
   * Returns client if it exists and is logged in, even if startup isn't fully complete
   */
  public getClient (): MatrixClient | null {
    // Return client if it exists and is logged in, even during startup
    // This prevents the "Matrix Connection Required" UI when Matrix is actually working
    if (this.client && this.client.isLoggedIn() && !this.isShuttingDown) {
      return this.client
    }

    // Debug logging when client is null to help troubleshoot issues
    if (!this.client) {
      logger.debug('🔍 getClient() returning null: no client instance', {
        isInitializing: this.isInitializing,
        isStarted: this.isStarted,
        isShuttingDown: this.isShuttingDown
      })
    } else if (!this.client.isLoggedIn()) {
      logger.debug('🔍 getClient() returning null: client not logged in', {
        isInitializing: this.isInitializing,
        isStarted: this.isStarted,
        isShuttingDown: this.isShuttingDown
      })
    } else if (this.isShuttingDown) {
      logger.debug('🔍 getClient() returning null: client shutting down')
    }

    return null
  }

  /**
   * Check if client is available for basic operations (logged in)
   * Use this for UI state checks and basic Matrix operations
   */
  public isClientAvailable (): boolean {
    return !!(this.client && this.client.isLoggedIn() && !this.isShuttingDown)
  }

  /**
   * Check if client is ready (created and started)
   * Use this for operations that require full client initialization
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
        result,
        message: 'Client is logged in but startup not complete'
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
        // Check if secret storage is properly set up before attempting to load from it
        const hasSecretStorage = await crypto.isSecretStorageReady()
        if (!hasSecretStorage) {
          logger.debug('ℹ️ Secret storage not ready - skipping backup restoration (expected after MAS identity reset)')
          return
        }

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
        // Also expected after MAS identity reset when secret storage is cleared
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

      // Wait longer for WASM cleanup to prevent crypto errors
      await new Promise(resolve => setTimeout(resolve, 2000))

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

      // Stop crypto requests first to prevent WASM errors
      try {
        const crypto = this.client.getCrypto()
        if (crypto) {
          logger.debug('🔐 Stopping crypto operations...')
          // The crypto module has internal cleanup that happens automatically
          // when stopClient() is called, but we ensure it happens cleanly
        }
      } catch (error) {
        logger.warn('⚠️ Error accessing crypto during shutdown:', error)
      }

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

      // Wait a moment for WASM cleanup to complete
      await new Promise(resolve => setTimeout(resolve, 500))

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
      // Always use persistent device ID to prevent device ID changes on reload
      // First consolidate any existing device IDs
      this.consolidateDeviceIds(userId)

      // Check crypto store first to avoid device ID mismatches
      const cryptoStoreDeviceId = await this.getCryptoStoreDeviceId(userId)
      const storedDeviceId = this.getStoredDeviceId(userId)
      const serverDeviceId = credentials.deviceId

      let deviceId: string

      if (cryptoStoreDeviceId) {
        logger.warn('🔐 Using device ID from crypto store:', cryptoStoreDeviceId)
        deviceId = cryptoStoreDeviceId

        // Sync localStorage with crypto store to prevent future mismatches
        if (storedDeviceId !== cryptoStoreDeviceId) {
          logger.warn('🔄 Syncing localStorage with crypto store device ID')
          this.setStoredDeviceId(userId, cryptoStoreDeviceId)
        }
      } else if (storedDeviceId) {
        logger.warn('📱 Using stored device ID from localStorage:', storedDeviceId)
        deviceId = storedDeviceId
      } else if (serverDeviceId) {
        logger.warn('🔗 Using server-provided device ID:', serverDeviceId)
        deviceId = serverDeviceId
        // Store server device ID for future use
        this.setStoredDeviceId(userId, serverDeviceId)
      } else {
        throw new Error('No device ID available from crypto store, storage, or server.')
      }

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
          getSecretStorageKey: async (opts, name) => {
            // Element Web-style callback: check cache first during bootstrap operations
            const keyIds = Object.keys(opts.keys)
            logger.debug('🔑 getSecretStorageKey callback invoked', {
              availableKeys: keyIds,
              requestedName: name,
              isBeingAccessed: secretStorageBeingAccessed,
              hasCachedKeys: Object.keys(secretStorageKeys).length > 0
            })

            // Check the in-memory cache (Element Web pattern)
            if (secretStorageBeingAccessed) {
              // First try the actual requested key IDs
              for (const keyId of keyIds) {
                if (secretStorageKeys[keyId]) {
                  logger.debug(`🔑 getSecretStorageKey: returning cached key ${keyId}`)
                  return [keyId, secretStorageKeys[keyId]]
                }
              }

              // If no match, try the temporary bootstrap key
              if (secretStorageKeys.temp_bootstrap_key) {
                logger.debug('🔑 getSecretStorageKey: returning temporary bootstrap key')
                // Return using the first available key ID
                const keyId = keyIds[0] || 'temp_bootstrap_key'
                return [keyId, secretStorageKeys.temp_bootstrap_key]
              }
            }

            // CRITICAL FIX: Always try cached keys first, even when not explicitly bootstrapping
            // This prevents key clearing during sync when keys are temporarily not in cache
            for (const keyId of keyIds) {
              if (secretStorageKeys[keyId]) {
                logger.debug(`🔑 getSecretStorageKey: returning persistent cached key ${keyId}`)
                return [keyId, secretStorageKeys[keyId]]
              }
            }

            // Try the bootstrap key as fallback for any key request
            if (secretStorageKeys.temp_bootstrap_key) {
              logger.debug('🔑 getSecretStorageKey: returning bootstrap key as fallback')
              const keyId = keyIds[0] || 'temp_bootstrap_key'
              return [keyId, secretStorageKeys.temp_bootstrap_key]
            }

            // CRITICAL FIX: Only prompt for security key during intentional encryption operations
            // Check if this is for an encryption-related secret (not just random sync operations)
            const isEncryptionSecret = name && (
              name.includes('cross_signing') ||
              name.includes('megolm_backup') ||
              name.includes('secret_storage')
            )

            if (!isEncryptionSecret) {
              logger.debug('🔑 getSecretStorageKey: not an encryption secret, skipping user prompt', { name })
              throw new Error(`Secret storage key not available for ${name || 'unknown'} - no user interaction for non-encryption secrets`)
            }

            logger.debug('🔑 getSecretStorageKey: encryption secret requested, prompting user for passphrase', { name })

            // Get key info from the first available key ID
            const keyId = keyIds[0]
            if (!keyId) {
              throw new Error('No secret storage key IDs provided')
            }

            // Get key info from opts (Matrix SDK provides this)
            const keyInfo = opts.keys[keyId]

            if (!keyInfo) {
              throw new Error(`Secret storage key info not found for ${keyId}`)
            }

            // Prompt user for passphrase and derive key (only for encryption secrets)
            const derivedKey = await promptForSecretStoragePassphrase(keyInfo)

            if (!derivedKey) {
              throw new Error('User cancelled secret storage key prompt')
            }

            // Cache the key for this session
            secretStorageKeys[keyId] = derivedKey
            secretStorageKeyInfo[keyId] = keyInfo

            logger.debug('✅ Secret storage key derived and cached from user input')
            return [keyId, derivedKey]
          },
          cacheSecretStorageKey: (keyId, keyInfo, key) => {
            // Cache key for session (this follows Element-Web pattern)
            logger.debug('🔑 cacheSecretStorageKey callback invoked for keyId:', keyId)
            // Actually cache the key so it can be used for export operations
            if (key) {
              secretStorageKeys[keyId] = key
              secretStorageKeyInfo[keyId] = keyInfo
              logger.debug(`🔑 Cached secret storage key ${keyId} for export operations`)
            }
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

        // Create a wrapped function for error handling
        const tokenRefreshFunction = async (refreshToken: string) => {
          try {
            const result = await tokenRefresher.doRefreshAccessToken(refreshToken)
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

    // Listen for crypto events to detect cross-signing key changes
    this.client.on(CryptoEvent.KeysChanged, () => {
      logger.debug('🔍 Crypto keys changed event detected')
      this.checkCrossSigningKeyStatus()
    })

    // Listen for device verification status changes to detect device ID mismatches
    this.client.on(CryptoEvent.DevicesUpdated, (users: string[]) => {
      const currentUserId = this.client?.getUserId()
      if (currentUserId && users.includes(currentUserId)) {
        logger.debug('🔍 Own device status updated, checking for device ID mismatch')
        this.checkDeviceIdMismatch()
      }
    })

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
   * Get device ID from Matrix SDK crypto store (IndexedDB)
   * This checks what device ID the crypto store expects to avoid mismatches
   */
  private async getCryptoStoreDeviceId (userId: string): Promise<string | null> {
    try {
      // Check if there are any crypto store databases for this user
      const databases = await indexedDB.databases()
      const cryptoDbPattern = new RegExp(`matrix-js-sdk:crypto:${userId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:([^:]+)`)

      for (const db of databases) {
        if (db.name && cryptoDbPattern.test(db.name)) {
          const match = db.name.match(cryptoDbPattern)
          if (match && match[1]) {
            const deviceId = match[1]
            logger.debug('🔍 Found crypto store device ID:', deviceId, 'in database:', db.name)
            return deviceId
          }
        }
      }

      logger.debug('📱 No crypto store found for user:', userId)
      return null
    } catch (error) {
      logger.warn('⚠️ Failed to check crypto store device ID:', error)
      return null
    }
  }

  /**
   * Set device ID in localStorage
   */
  private setStoredDeviceId (userId: string, deviceId: string): void {
    const storageKey = `matrix_device_id_${userId}`

    try {
      localStorage.setItem(storageKey, deviceId)
      logger.debug('💾 Stored device ID for user:', userId, 'deviceId:', deviceId)

      // Also sync with OpenMeet device ID storage if needed
      const openMeetDeviceId = this.getOpenMeetDeviceId()
      if (!openMeetDeviceId || openMeetDeviceId !== deviceId) {
        // Extract user slug from userId for OpenMeet storage
        const match = userId.match(/@([^_]+)_/)
        if (match) {
          const userSlug = match[1]
          localStorage.setItem(`device_id_${userSlug}`, deviceId)
          logger.debug('🔄 Synced OpenMeet device ID storage for slug:', userSlug)
        }
      }
    } catch (error) {
      logger.warn('⚠️ Failed to store device ID:', error)
    }
  }

  /**
   * Get stored device ID for a user
   * Device IDs should only come from Matrix server or previous storage, never generated client-side
   */
  private getStoredDeviceId (userId: string): string | null {
    const storageKey = `matrix_device_id_${userId}`

    try {
      // First try to get from Matrix device ID storage
      const existingDeviceId = localStorage.getItem(storageKey)
      if (existingDeviceId) {
        logger.warn('📱 Using existing stored device ID:', existingDeviceId)
        return existingDeviceId
      }

      // Try to get from OpenMeet device ID storage for consistency
      const openMeetDeviceId = this.getOpenMeetDeviceId()
      if (openMeetDeviceId) {
        logger.warn('📱 Using OpenMeet stored device ID:', openMeetDeviceId)
        // Store it in Matrix format for future use
        localStorage.setItem(storageKey, openMeetDeviceId)
        return openMeetDeviceId
      }

      logger.debug('📱 No stored device ID found for user:', userId)
      return null
    } catch (error) {
      logger.error('❌ Failed to get stored device ID:', error)
      return null
    }
  }

  /**
   * Get a consistent device ID, using the Matrix device ID if available
   */
  private getOpenMeetDeviceId (): string | null {
    try {
      // Look for existing Matrix device ID for this user to reuse
      const userId = '@b-b-pryyzu_lsdfaopkljdfs:matrix.openmeet.net'
      const existingMatrixDeviceId = localStorage.getItem(`matrix_device_id_${userId}`)
      if (existingMatrixDeviceId) {
        logger.warn('🔗 Reusing existing Matrix device ID:', existingMatrixDeviceId)
        return existingMatrixDeviceId
      }

      // Look for user slug based device ID
      const userSlugDeviceId = localStorage.getItem('matrix_device_id_b-b-pryyzu')
      if (userSlugDeviceId) {
        logger.warn('🔗 Found user slug device ID:', userSlugDeviceId)
        return userSlugDeviceId
      }

      logger.debug('📱 No existing device ID found in localStorage')
      return null
    } catch (error) {
      logger.debug('📱 Could not access device ID:', error.message)
      return null
    }
  }

  /**
   * Consolidate multiple device IDs into one consistent ID
   */
  private consolidateDeviceIds (userId: string): void {
    try {
      const fullUserIdKey = `matrix_device_id_${userId}`
      const userSlugKey = 'matrix_device_id_b-b-pryyzu'

      const fullUserId = localStorage.getItem(fullUserIdKey)
      const userSlugId = localStorage.getItem(userSlugKey)

      if (fullUserId && userSlugId && fullUserId !== userSlugId) {
        // Use the more recent one (assume full user ID is newer pattern)
        logger.warn('🔄 Consolidating device IDs:', { fullUserId, userSlugId, using: fullUserId })
        localStorage.setItem(userSlugKey, fullUserId)
      } else if (fullUserId && !userSlugId) {
        logger.warn('🔄 Copying full user device ID to slug format:', fullUserId)
        localStorage.setItem(userSlugKey, fullUserId)
      } else if (!fullUserId && userSlugId) {
        logger.warn('🔄 Copying slug device ID to full user format:', userSlugId)
        localStorage.setItem(fullUserIdKey, userSlugId)
      }
    } catch (error) {
      logger.warn('⚠️ Failed to consolidate device IDs:', error)
    }
  }

  /**
   * Clear all device-related storage for a fresh start
   */
  public clearAllDeviceStorage (userId: string): void {
    try {
      // Clear Matrix device ID
      const matrixStorageKey = `matrix_device_id_${userId}`
      localStorage.removeItem(matrixStorageKey)

      // Clear OpenMeet device ID (find by pattern)
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i)
        if (key && key.startsWith('device_id_')) {
          localStorage.removeItem(key)
          logger.warn('🗑️ Cleared OpenMeet device ID:', key)
        }
      }

      logger.warn('🗑️ Cleared all device storage for user:', userId)
    } catch (error) {
      logger.error('❌ Failed to clear device storage:', error)
    }
  }

  /**
   * Clear the persistent device ID for a user (for testing or troubleshooting)
   */
  public clearPersistentDeviceId (userId: string): void {
    const storageKey = `matrix_device_id_${userId}`
    try {
      localStorage.removeItem(storageKey)
      logger.warn('🗑️ Cleared persistent device ID for user:', userId)
    } catch (error) {
      logger.error('❌ Failed to clear persistent device ID:', error)
    }
  }

  /**
   * Complete Matrix reset - clears everything and forces fresh start
   * This is useful for troubleshooting or when you need a completely clean state
   */
  public async resetMatrixCompletely (userId?: string): Promise<void> {
    logger.warn('🚨 Starting complete Matrix reset...')

    try {
      // Step 1: Gracefully stop and clear the client
      await this.clearClient()

      // Step 2: Clear all device-related storage
      if (userId) {
        this.clearAllDeviceStorage(userId)
      } else {
        // Clear all device storage patterns
        const deviceKeys = []
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i)
          if (key && (key.startsWith('matrix_device_id_') || key.startsWith('device_id_'))) {
            deviceKeys.push(key)
          }
        }
        deviceKeys.forEach(key => {
          localStorage.removeItem(key)
          logger.warn('🗑️ Cleared device storage:', key)
        })
      }

      // Step 3: Clear all Matrix-related localStorage
      const matrixKeys = []
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i)
        if (key && (
          key.startsWith('matrix_') ||
          key.includes('matrix-js-sdk') ||
          key.includes('matrix-crypto') ||
          (userId && key.includes(userId))
        )) {
          matrixKeys.push(key)
        }
      }

      matrixKeys.forEach(key => {
        localStorage.removeItem(key)
        logger.warn('🗑️ Cleared localStorage:', key)
      })

      // Step 4: Clear sessionStorage
      const sessionKeys = []
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const key = sessionStorage.key(i)
        if (key && (
          key.startsWith('matrix_') ||
          (userId && key.includes(userId))
        )) {
          sessionKeys.push(key)
        }
      }

      sessionKeys.forEach(key => {
        sessionStorage.removeItem(key)
        logger.warn('🗑️ Cleared sessionStorage:', key)
      })

      // Step 5: Clear all Matrix IndexedDB databases
      try {
        const databases = await indexedDB.databases()
        const matrixDbs = databases.filter(db =>
          db.name && (
            db.name.includes('matrix-js-sdk') ||
            db.name.includes('matrix-crypto') ||
            db.name.includes('matrix_') ||
            (userId && db.name.includes(userId))
          )
        )

        for (const db of matrixDbs) {
          if (db.name) {
            try {
              await new Promise<void>((resolve, reject) => {
                const deleteReq = indexedDB.deleteDatabase(db.name!)
                deleteReq.onsuccess = () => {
                  logger.warn(`🗑️ Cleared IndexedDB: ${db.name}`)
                  resolve()
                }
                deleteReq.onerror = () => reject(deleteReq.error)
                deleteReq.onblocked = () => {
                  logger.warn(`⚠️ IndexedDB deletion blocked: ${db.name}`)
                  resolve() // Continue anyway
                }
              })
            } catch (dbError) {
              logger.warn(`⚠️ Failed to delete IndexedDB ${db.name}:`, dbError)
            }
          }
        }

        logger.warn(`🗑️ Cleared ${matrixDbs.length} Matrix databases`)
      } catch (dbListError) {
        logger.warn('⚠️ Failed to list IndexedDB databases:', dbListError)
      }

      // Step 6: Reset singleton state
      this.client = null
      this.isStarted = false
      this.isInitializing = false
      this.initPromise = null
      this.isShuttingDown = false
      this.eventListenersSetup = false
      this.cryptoInitPromise = null
      this.cryptoInitialized = false
      this.cryptoInitializing = false

      logger.warn('✅ Complete Matrix reset finished - all data cleared')
    } catch (error) {
      logger.error('❌ Complete Matrix reset failed:', error)
      throw error
    }
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

  /**
   * Check for device ID mismatches that can cause "own device might have been deleted" errors
   */
  private async checkDeviceIdMismatch (): Promise<void> {
    try {
      if (!this.client) return

      const crypto = this.client.getCrypto()
      if (!crypto) return

      const userId = this.client.getUserId()
      const currentDeviceId = this.client.getDeviceId()

      if (!userId || !currentDeviceId) return

      // Get device info from server to check for mismatch
      const userDeviceInfo = await crypto.getUserDeviceInfo([userId], true) // downloadUncached = true
      const serverDevices = userDeviceInfo.get(userId)

      if (!serverDevices) {
        logger.warn('⚠️ No device info returned from server for current user')
        return
      }

      // Check if our current device ID exists on server
      const currentDeviceExists = serverDevices.has(currentDeviceId)

      if (!currentDeviceExists) {
        logger.error('❌ Device ID mismatch detected! Current device ID not found on server', {
          currentDeviceId,
          serverDeviceIds: Array.from(serverDevices.keys()),
          userId
        })

        // This indicates a device ID desync - crypto store has old device ID
        // Clear crypto store and force re-initialization
        await this.handleDeviceIdMismatch(userId, currentDeviceId)
      } else {
        logger.debug('✅ Device ID verified - current device exists on server')
      }
    } catch (error) {
      logger.warn('⚠️ Failed to check device ID mismatch:', error)
    }
  }

  /**
   * Handle device ID mismatch by clearing crypto store and forcing re-initialization
   */
  private async handleDeviceIdMismatch (userId: string, oldDeviceId: string): Promise<void> {
    try {
      logger.warn('🔄 Handling device ID mismatch - clearing crypto store and restarting client')

      // Stop the current client
      if (this.client) {
        this.client.stopClient()
      }

      // Clear the crypto store that contains the old device ID
      await this.clearCryptoStore(userId, oldDeviceId)

      // The correct device ID should already be in localStorage or server credentials
      // Don't arbitrarily pick a device ID - let the normal device ID resolution handle it

      logger.warn('🔄 Device ID mismatch handled - user should refresh page to use correct device ID')

      // Notify user that refresh is needed to complete recovery
      const event = new CustomEvent('matrix-device-mismatch-recovered', {
        detail: {
          oldDeviceId,
          message: 'Device ID mismatch recovered. Please refresh the page to continue.'
        }
      })
      window.dispatchEvent(event)
    } catch (error) {
      logger.error('❌ Failed to handle device ID mismatch:', error)
    }
  }

  /**
   * Check cross-signing key status and attempt recovery if needed
   * This is called when crypto keys change to detect key clearing
   */
  private async checkCrossSigningKeyStatus (): Promise<void> {
    if (!this.client) return

    const crypto = this.client.getCrypto()
    if (!crypto) return

    try {
      const status = await crypto.getCrossSigningStatus()
      const hasAllKeys = status.privateKeysCachedLocally.masterKey &&
                        status.privateKeysCachedLocally.selfSigningKey &&
                        status.privateKeysCachedLocally.userSigningKey

      if (!hasAllKeys) {
        logger.warn('🚨 Cross-signing keys missing after crypto event - attempting recovery')
        logger.debug('🔧 Missing keys:', {
          masterKey: !status.privateKeysCachedLocally.masterKey,
          selfSigningKey: !status.privateKeysCachedLocally.selfSigningKey,
          userSigningKey: !status.privateKeysCachedLocally.userSigningKey
        })

        // Emit event for UI components to show status
        window.dispatchEvent(new CustomEvent('matrix:crossSigningKeysLost', {
          detail: { status }
        }))

        // Try to recover keys using MatrixEncryptionService
        // Note: Import dynamically to avoid circular dependency
        const { MatrixEncryptionService } = await import('./MatrixEncryptionService')
        const encryptionService = new MatrixEncryptionService(this.client)

        const recovered = await encryptionService.handleCrossSigningKeyLoss()
        if (recovered) {
          logger.debug('✅ Cross-signing keys successfully recovered')
          window.dispatchEvent(new CustomEvent('matrix:crossSigningKeysRecovered'))
        } else {
          logger.warn('❌ Cross-signing key recovery failed - user intervention may be needed')
        }
      }
    } catch (error) {
      logger.warn('Failed to check cross-signing key status:', error)
    }
  }
}

// Export singleton instance
export const matrixClientManager = MatrixClientManager.getInstance()
