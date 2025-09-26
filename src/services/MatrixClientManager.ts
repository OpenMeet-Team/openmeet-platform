import type { MatrixClient, ICreateClientOpts, MatrixError as SdkMatrixError, MatrixEvent, Room, OidcClientConfig, ICreateRoomOpts } from 'matrix-js-sdk'
import type { RoomMessageEventContent } from 'matrix-js-sdk/lib/@types/events'
import { ClientEvent, createClient, IndexedDBStore, HttpApiEvent, IndexedDBCryptoStore, LocalStorageCryptoStore, MemoryCryptoStore, generateOidcAuthorizationUrl, completeAuthorizationCodeGrant, registerOidcClient, EventType } from 'matrix-js-sdk'
import { Visibility, Preset } from 'matrix-js-sdk/lib/@types/partials'
import { CryptoEvent } from 'matrix-js-sdk/lib/crypto-api'
import type { IdTokenClaims } from 'oidc-client-ts'
import { parseRoomAlias } from '../utils/matrixUtils'
import { matrixTokenManager } from './MatrixTokenManager'
import { PlatformTokenRefresher } from './PlatformTokenRefresher'
// Note: Using inline cryptoCallbacks instead of MatrixSecurityManager for simplicity
import { logger } from '../utils/logger'
import { matrixDeviceListener } from './MatrixDeviceListener'
import { Dialog, Notify } from 'quasar'
import type { MatrixMessageContent } from '../types/matrix'
import getEnv from '../utils/env'
import { useAuthStore } from '../stores/auth-store'
// Config will be accessed via getEnv

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
async function promptForSecretStoragePassphrase (keyInfo: SecretStorageKeyInfo, secretName?: string): Promise<Uint8Array | null> {
  // CRITICAL FIX: Don't show security key dialog during initial setup or when no recovery key exists
  // This prevents the confusing "Security Key Needed" popup for new users
  const isInitialSetup = localStorage.getItem('matrix_initial_encryption_setup_completed')
  const recentSetup = isInitialSetup && (Date.now() - parseInt(isInitialSetup)) < 600000 // 10 minutes

  if (recentSetup) {
    logger.debug('🔐 Skipping security key prompt during recent initial setup')
    return null
  }

  // Also skip if this appears to be for fresh encryption setup (no existing recovery)
  const hasLastEncryptionSetup = localStorage.getItem('lastEncryptionSetup')
  if (!hasLastEncryptionSetup && secretName?.includes('cross_signing')) {
    logger.debug('🔐 Skipping security key prompt for fresh encryption setup (no existing recovery)')
    return null
  }

  return new Promise((resolve) => {
    const reasonMessage = secretName?.includes('cross_signing')
      ? 'This is needed to verify your devices and access encrypted messages.'
      : secretName?.includes('megolm_backup')
        ? 'This is needed to decrypt your message history from backups.'
        : 'This is needed for encrypted messaging features.'

    Dialog.create({
      title: 'Security Key Needed',
      message: `<div style="margin-bottom: 16px;">
        <p><strong>Why:</strong> ${reasonMessage}</p>
        <p><strong>When:</strong> You can enter this now or dismiss and try again later when you need encrypted features.</p>
        <p>Enter your security passphrase:</p>
      </div>`,
      html: true,
      prompt: {
        model: '',
        type: 'password',
        placeholder: 'Security passphrase'
      },
      persistent: false, // Allow dismissing by clicking outside
      ok: {
        label: 'Unlock Now',
        color: 'primary'
      },
      cancel: {
        label: 'Ask Me Later',
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

        logger.debug('🔑 RECOVERY KEY DEBUG: Starting key derivation')
        logger.debug('🔑 Recovery key input length:', passphrase.length)
        logger.debug('🔑 Recovery key first 10 chars:', passphrase.substring(0, 10))
        logger.debug('🔑 KeyInfo details:', {
          algorithm: keyInfo.algorithm,
          passphrase: keyInfo.passphrase ? 'present' : 'missing',
          keyInfoKeys: Object.keys(keyInfo)
        })

        const derivedKey = await deriveKeyFromPassphrase(passphrase, keyInfo)

        logger.debug('🔑 RECOVERY KEY DEBUG: Key derivation completed')
        logger.debug('🔑 Derived key length:', derivedKey.length)
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
      logger.debug('🚫 User cancelled secret storage passphrase prompt for:', secretName || 'unknown secret')
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

// Export functions for MatrixEncryptionManager to use
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

  // Encryption manager for room key sharing policies
  private encryptionManager: import('./MatrixEncryptionManager').MatrixEncryptionManager | null = null

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
   * Check if Matrix client is currently initializing (e.g. during app startup)
   * Components should wait for initialization to complete before showing "Connect to Matrix"
   */
  public isClientInitializing (): boolean {
    return this.isInitializing
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
    const syncState = this.client?.getSyncState()
    const isPrepared = syncState === 'PREPARED'

    // Also consider SYNCING as ready if client is functional
    // This handles cases where client gets stuck in SYNCING but is actually working
    const isSyncingAndFunctional = syncState === 'SYNCING' && loggedIn

    // Consider ready if logged in AND (startup complete OR client is prepared OR syncing and functional)
    const result = loggedIn && (this.isStarted || isPrepared || isSyncingAndFunctional) && !this.isShuttingDown

    return result
  }

  /**
   * Check if crypto is available and initialized
   */
  public isCryptoReady (): boolean {
    return this.cryptoInitialized && this.client?.getCrypto() != null
  }

  /**
   * Check if client is logged in with valid tokens
   * Makes a real-time API call to validate tokens are still active
   * Use this when token validity is critical (e.g., before joining rooms)
   */
  public async isValidlyLoggedIn (): Promise<boolean> {
    // Basic login check first
    if (!this.client || !this.client.isLoggedIn() || this.isShuttingDown) {
      return false
    }

    // Validate tokens with Matrix server
    try {
      await this.client.whoami()
      return true
    } catch (error) {
      logger.warn('⚠️ Token validation failed - client is in zombie state:', error)
      return false
    }
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
   * Initialize Matrix client automatically after auth store is ready
   * This should be called during app startup to restore sessions
   */
  public async initializeClientWhenReady (): Promise<MatrixClient | null> {
    // Set initializing flag to prevent components from showing "Connect" too early
    this.isInitializing = true
    logger.debug('📱 Starting app startup Matrix client initialization...')

    try {
      // CRITICAL: Check if we're in the middle of OAuth callback processing
      const currentPath = window.location.pathname
      const redirectPath = getEnv('APP_MAS_REDIRECT_PATH') as string

      if (currentPath === redirectPath) {
        logger.debug('🔄 OAuth callback in progress - skipping app startup initialization to prevent race condition')
        this.isInitializing = false
        return null
      }

      const authStore = useAuthStore()

      // Wait for auth store to be initialized
      if (!authStore.isInitialized) {
        logger.debug('📱 Waiting for auth store to be initialized before Matrix client restore...')
        await authStore.waitForInitialization()
      }

      const client = await this.initializeClient()

      if (client) {
        logger.debug('✅ Matrix client restored successfully during app startup')
      } else {
        logger.debug('📱 No stored session found during app startup - user will need to connect')
      }

      return client
    } finally {
      this.isInitializing = false
      logger.debug('📱 App startup Matrix client initialization completed')
    }
  }

  /**
   * Initialize Matrix client from stored session (Element Web pattern)
   * Like Element Web's restoreSessionFromStorage() - only restores existing sessions
   * @returns Promise<MatrixClient | null> - client if session restored, null if no session
   */
  public async initializeClient (): Promise<MatrixClient | null> {
    // Return existing client if already initialized and tokens are valid
    if (this.client && !this.isShuttingDown) {
      const isValid = await this.isValidlyLoggedIn()
      if (isValid) {
        logger.debug('✅ Matrix client already initialized with valid tokens')
        return this.client
      } else {
        logger.debug('🧟 Existing client has invalid tokens, clearing and reinitializing')
        await this.clearClientAndCredentials()
      }
    }

    // Try to restore from stored session (like Element Web's restoreSessionFromStorage)
    if (this.hasStoredSession()) {
      try {
        return await this.restoreFromStoredSession()
      } catch (error) {
        logger.warn('⚠️ Failed to restore from stored session:', error)
        return null
      }
    }

    logger.debug('🔍 No stored session found')
    return null
  }

  /**
   * Restore Matrix client from stored session data
   * Like Element Web's restoreSessionFromStorage logic
   */
  private async restoreFromStoredSession (): Promise<MatrixClient> {
    const homeserverUrl = getEnv('APP_MATRIX_HOMESERVER_URL') as string

    // Get current OpenMeet user for user-specific storage keys
    const authStore = useAuthStore()

    // Wait for auth store to be initialized
    if (!authStore.isInitialized) {
      throw new Error('Auth store not initialized yet - cannot restore Matrix session')
    }

    const openMeetUserSlug = authStore.getUserSlug

    if (!openMeetUserSlug) {
      throw new Error('No OpenMeet user logged in for Matrix session restore')
    }

    // Try to get session data from legacy storage first (for migration)
    const sessionKey = `matrix_session_${openMeetUserSlug}`
    const sessionDataJson = localStorage.getItem(sessionKey)

    if (!sessionDataJson) {
      throw new Error('No Matrix session data found for current user')
    }

    const sessionData = JSON.parse(sessionDataJson)
    const userId = sessionData.userId
    const deviceId = sessionData.deviceId

    if (!userId) {
      throw new Error('Incomplete session data in storage')
    }

    // Get tokens from MatrixTokenManager
    const tokenData = await matrixTokenManager.getTokens(userId)

    if (!tokenData?.accessToken && !tokenData?.refreshToken) {
      throw new Error('No Matrix tokens found - user needs to authenticate')
    }

    // Get the canonical stored device ID for consistent reuse
    const storedDeviceId = this.getStoredDeviceId()

    logger.debug('🔍 Device ID sources for session restore:', {
      storedDeviceId: storedDeviceId || 'none',
      tokenManagerDeviceId: tokenData.deviceId || 'none',
      legacySessionDeviceId: deviceId || 'none',
      finalDeviceId: storedDeviceId || tokenData.deviceId || deviceId
    })

    const credentials = {
      homeserverUrl,
      accessToken: tokenData.accessToken,
      userId,
      deviceId: storedDeviceId || tokenData.deviceId || deviceId,
      refreshToken: tokenData.refreshToken,
      oidcIssuer: tokenData.oidcIssuer,
      oidcClientId: tokenData.oidcClientId,
      oidcRedirectUri: tokenData.oidcRedirectUri,
      idTokenClaims: tokenData.idTokenClaims
    }

    logger.debug('🔍 DEBUG: Session restore credentials:', {
      hasAccessToken: !!tokenData.accessToken,
      hasRefreshToken: !!tokenData.refreshToken,
      hasOidcIssuer: !!tokenData.oidcIssuer,
      hasOidcClientId: !!tokenData.oidcClientId,
      hasOidcRedirectUri: !!tokenData.oidcRedirectUri,
      hasIdTokenClaims: !!tokenData.idTokenClaims,
      userId
    })

    return await this.initializeClientWithCredentials(credentials)
  }

  /**
   * Create Matrix client with explicit credentials (internal method)
   * Like Element Web's doSetLoggedIn() - used after OAuth completion
   * Made public for testing purposes
   */
  public async initializeClientWithCredentials (credentials: {
    homeserverUrl: string
    accessToken?: string
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

    // Initialize encryption manager to handle room key sharing policies
    try {
      const { MatrixEncryptionManager } = await import('./MatrixEncryptionManager')
      this.encryptionManager = new MatrixEncryptionManager(this.client)
      await this.encryptionManager.start()
      logger.debug('✅ MatrixEncryptionManager initialized and started')
    } catch (error) {
      logger.warn('⚠️ Failed to initialize MatrixEncryptionManager:', error)
    }

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

      // Stop device listener for room key sharing
      matrixDeviceListener.stop()

      // Stop encryption manager
      if (this.encryptionManager) {
        try {
          await this.encryptionManager.stop()
          logger.debug('✅ MatrixEncryptionManager stopped')
        } catch (error) {
          logger.warn('⚠️ Error stopping MatrixEncryptionManager:', error)
        } finally {
          this.encryptionManager = null
        }
      }

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
    this.encryptionManager = null
  }

  /**
   * Clear client and SDK state when tokens are invalid
   * NOTE: Preserves token storage (matrix_session_*) to allow refresh attempts
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

    // Clear stored credentials from localStorage - only for current user
    try {
      // Get current user identifier to target specific credentials
      const currentUserId = this.client?.getUserId()
      const authStore = useAuthStore()
      const userSlug = authStore.getUserSlug || ''

      // Clear Matrix SDK state but preserve tokens needed for refresh
      const keysToRemove = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith('matrix_')) {
          // CRITICAL: Never clear matrix_session_* keys - these contain tokens needed for refresh
          if (key.startsWith('matrix_session_')) {
            logger.debug('🔒 Preserving token storage during cleanup:', key)
            continue // Skip token storage - preserve for refresh attempts
          }

          // Only clear other Matrix credentials that contain current user identifiers
          if (currentUserId && key.includes(currentUserId)) {
            keysToRemove.push(key)
          } else if (userSlug && key.includes(userSlug)) {
            keysToRemove.push(key)
          } else if (!currentUserId && !userSlug) {
            // Fallback: if we can't identify current user, clear generic matrix keys without user identifiers
          }
        } else if (key && (key.includes('matrix-js-sdk') || key.includes('matrix-crypto'))) {
          // Also clear matrix-js-sdk and matrix-crypto keys that are generic (not user-specific)
          // Only clear if they don't contain user identifiers
          if (currentUserId && key.includes(currentUserId)) {
            keysToRemove.push(key)
          } else if (!key.includes('@') && !key.includes(':')) {
            keysToRemove.push(key)
          }
        }
      }

      keysToRemove.forEach(key => {
        localStorage.removeItem(key)
        logger.debug(`🧹 Removed stored credential: ${key}`)
      })

      // Also clear sessionStorage - only for current user
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i)
        if (key && key.startsWith('matrix_')) {
          if (currentUserId && key.includes(currentUserId)) {
            sessionStorage.removeItem(key)
            logger.debug(`🧹 Removed session credential: ${key}`)
          } else if (userSlug && key.includes(userSlug)) {
            sessionStorage.removeItem(key)
            logger.debug(`🧹 Removed session credential: ${key}`)
          } else if (!currentUserId && !userSlug && !key.includes('@') && !key.includes(':') && !key.includes('_01')) {
            sessionStorage.removeItem(key)
            logger.debug(`🧹 Removed session credential: ${key}`)
          }
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
    accessToken?: string
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

      // Wait for auth store to be initialized before device storage operations
      const authStore = useAuthStore()
      if (!authStore.isInitialized) {
        logger.debug('📱 Waiting for auth store to be initialized for device storage...')
        await authStore.waitForInitialization()
      }

      // Determine base URL
      let baseUrl = credentials.homeserverUrl
      if (!baseUrl.startsWith('http')) {
        baseUrl = `https://${baseUrl}`
      }

      // Create optimized IndexedDB stores
      const userId = credentials.userId
      // Always use persistent device ID to prevent device ID changes on reload

      // Follow Element Web pattern: Always use server-provided device ID (server authority)
      // This prevents conflicts between server authentication and client device expectations
      const serverDeviceId = credentials.deviceId
      const storedDeviceId = this.getStoredDeviceId()

      if (!serverDeviceId) {
        throw new Error('No device ID provided by Matrix server during authentication.')
      }

      const deviceId = serverDeviceId
      logger.debug('🔗 Using server-provided device ID (Element Web pattern):', deviceId)

      // Store server device ID for session tracking
      this.setStoredDeviceId(userId, deviceId)

      // Check if this is a new device (different from stored)
      if (storedDeviceId && storedDeviceId !== deviceId) {
        logger.warn('📱 Server issued new device ID - clearing old crypto store to prevent conflicts')
        // Clear old crypto store to prevent device ID mismatches
        await this.clearCryptoStore(userId, storedDeviceId)
      }

      // Use separate databases for main store and crypto store
      const store = new IndexedDBStore({
        indexedDB: window.indexedDB,
        dbName: `matrix-js-sdk:${userId}:${deviceId}`
      })

      // Create the client with refresh token support
      const clientOptions: ICreateClientOpts = {
        baseUrl,
        ...(credentials.accessToken && { accessToken: credentials.accessToken }),
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
            logger.debug('🔑 SECRET STORAGE DEBUG: getSecretStorageKey callback invoked', {
              availableKeys: keyIds,
              requestedName: name,
              isBeingAccessed: secretStorageBeingAccessed,
              hasCachedKeys: Object.keys(secretStorageKeys).length > 0,
              secretName: name,
              isForCrossSigning: name?.includes('cross_signing'),
              isForBackup: name?.includes('backup')
            })

            // CRITICAL FIX: Don't prompt for keys during initial setup when none exist yet
            const isInitialSetup = localStorage.getItem('matrix_initial_encryption_setup_completed')
            const recentSetup = isInitialSetup && (Date.now() - parseInt(isInitialSetup)) < 600000 // 10 minutes

            if (recentSetup && !secretStorageBeingAccessed) {
              logger.debug('🔐 Skipping secret storage key request during recent initial setup')
              throw new Error('Secret storage not available during initial setup')
            }

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
            const derivedKey = await promptForSecretStoragePassphrase(keyInfo, name)

            if (!derivedKey) {
              throw new Error('User cancelled secret storage key prompt')
            }

            // Cache the key for this session
            secretStorageKeys[keyId] = derivedKey
            secretStorageKeyInfo[keyId] = keyInfo

            logger.debug('🔑 SECRET STORAGE DEBUG: Key successfully derived and cached', {
              keyId,
              keyLength: derivedKey.length,
              secretName: name,
              keyInfoAlgorithm: keyInfo.algorithm
            })
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

      // Add refresh token support with unified MatrixTokenManager pattern
      logger.debug('🔍 DEBUG: Token refresh setup check:', {
        hasRefreshToken: !!credentials.refreshToken,
        hasOidcIssuer: !!credentials.oidcIssuer,
        hasOidcClientId: !!credentials.oidcClientId,
        refreshToken: credentials.refreshToken,
        oidcIssuer: credentials.oidcIssuer,
        oidcClientId: credentials.oidcClientId
      })

      if (credentials.refreshToken && credentials.oidcIssuer && credentials.oidcClientId) {
        logger.debug('🔑 Configuring MatrixTokenManager for OIDC token management', {
          hasRefreshToken: !!credentials.refreshToken,
          oidcIssuer: credentials.oidcIssuer,
          oidcClientId: credentials.oidcClientId,
          deviceId
        })

        // Initialize OIDC configuration in MatrixTokenManager
        await matrixTokenManager.initializeOidcConfig(userId, {
          issuer: credentials.oidcIssuer,
          clientId: credentials.oidcClientId,
          redirectUri: credentials.oidcRedirectUri,
          idTokenClaims: credentials.idTokenClaims || {} as IdTokenClaims
        })

        // Store tokens in unified MatrixTokenManager (only if we have valid tokens)
        if (credentials.accessToken || credentials.refreshToken) {
          logger.debug('🔧 Additional data being passed to setTokens:', {
            deviceId,
            hasDeviceId: !!deviceId,
            deviceIdType: typeof deviceId,
            oidcIssuer: credentials.oidcIssuer,
            oidcClientId: credentials.oidcClientId,
            hasAccessToken: !!credentials.accessToken,
            hasRefreshToken: !!credentials.refreshToken
          })

          await matrixTokenManager.setTokens(userId, {
            accessToken: credentials.accessToken,
            refreshToken: credentials.refreshToken,
            expiry: undefined // Will be set by token manager based on response
          }, {
            deviceId,
            oidcIssuer: credentials.oidcIssuer,
            oidcClientId: credentials.oidcClientId,
            oidcRedirectUri: credentials.oidcRedirectUri,
            idTokenClaims: credentials.idTokenClaims
          })
        } else {
          logger.debug('🔧 Skipping setTokens() call - no valid tokens to store:', {
            hasAccessToken: !!credentials.accessToken,
            hasRefreshToken: !!credentials.refreshToken,
            deviceId
          })
        }

        // Use SDK's OidcTokenRefresher following Element Web pattern
        // This eliminates manual token refresh and ensures proper client token state management
        const tokenRefresher = new PlatformTokenRefresher(
          credentials.oidcIssuer,
          credentials.oidcClientId,
          credentials.oidcRedirectUri || getEnv('APP_BASE_URL') as string,
          deviceId,
          credentials.idTokenClaims || {} as IdTokenClaims,
          userId
        )

        // Wait for the OIDC client to initialize
        await tokenRefresher.oidcClientReady

        clientOptions.refreshToken = credentials.refreshToken
        clientOptions.tokenRefreshFunction = tokenRefresher.doRefreshAccessToken.bind(tokenRefresher)
        logger.debug('🔑 Matrix client configured with SDK PlatformTokenRefresher')
        logger.debug('🔧 tokenRefreshFunction set to:', typeof clientOptions.tokenRefreshFunction)
      } else if (credentials.refreshToken) {
        // Fallback: We have refresh token but missing OIDC config
        // Still avoid using SDK's built-in refresh due to double slash bug
        logger.debug('⚠️ Refresh token found but missing OIDC config - cannot set up token refresh')
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

      // Store basic session metadata (tokens are handled by MatrixTokenManager)
      logger.debug('💾 Storing session metadata to localStorage')
      localStorage.setItem('matrix_user_id', credentials.userId)
      localStorage.setItem('matrix_device_id', deviceId)

      // All tokens and OIDC metadata are now stored in MatrixTokenManager

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

        // Dispatch matrix:ready event for UI components
        const readyEvent = new CustomEvent('matrix:ready', {
          detail: {
            client: this.client,
            roomCount: rooms.length,
            state,
            timestamp: new Date().toISOString()
          }
        })
        window.dispatchEvent(readyEvent)
        logger.debug('🎉 Dispatched matrix:ready event')
      }
    }

    // Store session logged out handler for cleanup (Element Web pattern)
    this.sessionLoggedOutHandler = (error: SdkMatrixError) => {
      logger.warn('Matrix session logged out event received - letting SDK handle token refresh', error)

      // Just emit notification event for UI components
      // Don't destroy the client - let the SDK handle token refresh internally
      const tokenErrorEvent = new CustomEvent('matrix:tokenError', {
        detail: {
          error,
          context: 'matrix_session_logged_out',
          sdkManagedTokenRefresh: true,
          action: 'notification_only'
        }
      })
      window.dispatchEvent(tokenErrorEvent)

      logger.debug('📢 SessionLoggedOut event handled - client preserved for SDK token refresh')
    }

    // Only essential listeners for performance
    this.client.on(ClientEvent.Sync, this.syncStateHandler)
    this.client.once(ClientEvent.Sync, this.readyHandler)

    // Check if client is already in PREPARED state and call readyHandler immediately
    const currentSyncState = this.client.getSyncState()
    if (currentSyncState === 'PREPARED' && this.readyHandler) {
      logger.debug('🎯 Client already in PREPARED state, calling readyHandler immediately')
      this.readyHandler(currentSyncState)
    }

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
   * Extract OpenMeet user slug from Matrix user ID
   * Matrix user ID format: @{username}_{tenantId}:matrix.openmeet.net
   */
  private extractOpenMeetUserSlug (matrixUserId: string): string | null {
    try {
      // Extract from pattern: @{anything}_{tenantId}:matrix.openmeet.net
      const match = matrixUserId.match(/@([^_]+)_[^:]+:matrix\.openmeet\.net$/)
      return match ? match[1] : null
    } catch (error) {
      logger.warn('⚠️ Failed to extract OpenMeet user slug from Matrix user ID:', matrixUserId, error)
      return null
    }
  }

  /**
   * Set device ID in localStorage using Matrix user ID to extract stable OpenMeet slug
   */
  private setStoredDeviceId (userId: string, deviceId: string): void {
    try {
      // Get stable OpenMeet user slug for consistent device storage
      const authStore = useAuthStore()
      const openMeetUserSlug = authStore.getUserSlug

      if (!openMeetUserSlug) {
        logger.warn('⚠️ No OpenMeet user slug available, cannot store device ID persistently')
        return
      }

      const storageKey = `matrix_device_id_${openMeetUserSlug}`
      localStorage.setItem(storageKey, deviceId)
      logger.debug('💾 Stored device ID for OpenMeet user:', openMeetUserSlug, 'deviceId:', deviceId)

      // Verify storage worked
      const verification = localStorage.getItem(storageKey)
      if (verification === deviceId) {
        logger.debug('✅ Device ID storage verified for user:', openMeetUserSlug)
      } else {
        logger.error('❌ Device ID storage verification failed for user:', openMeetUserSlug)
      }
    } catch (error) {
      logger.warn('⚠️ Failed to store device ID:', error)
    }
  }

  /**
   * Get stored device ID for a user
   * Device IDs should only come from Matrix server or previous storage, never generated client-side
   */
  private getStoredDeviceId (): string | null {
    try {
      // Get stable OpenMeet user slug for consistent device retrieval
      const authStore = useAuthStore()
      const openMeetUserSlug = authStore.getUserSlug

      if (!openMeetUserSlug) {
        logger.warn('⚠️ No OpenMeet user slug available, cannot retrieve stored device ID')
        return null
      }

      const storageKey = `matrix_device_id_${openMeetUserSlug}`
      const existingDeviceId = localStorage.getItem(storageKey)

      if (existingDeviceId) {
        logger.debug('📱 Found stored device ID for OpenMeet user:', openMeetUserSlug, 'deviceId:', existingDeviceId)
        return existingDeviceId
      }

      logger.debug('📱 No stored device ID found for OpenMeet user:', openMeetUserSlug)
      return null
    } catch (error) {
      logger.error('❌ Failed to get stored device ID:', error)
      return null
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
  public clearPersistentDeviceId (): void {
    try {
      // Clear device storage using stable OpenMeet user slug
      const authStore = useAuthStore()
      const openMeetUserSlug = authStore.getUserSlug

      if (openMeetUserSlug) {
        const storageKey = `matrix_device_id_${openMeetUserSlug}`
        localStorage.removeItem(storageKey)
        logger.warn('🗑️ Cleared persistent device ID for OpenMeet user:', openMeetUserSlug)
      }
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
      this.encryptionManager = null

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

      // Perform initial encryption setup for new logins
      // This prevents device key mismatch issues on subsequent logins
      await this.performInitialEncryptionSetup()

      // Start device listener for room key sharing (Element Web pattern)
      matrixDeviceListener.start(this.client)

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
   * Perform initial encryption setup for new logins
   * This prevents device key mismatch issues on subsequent logins
   */
  private async performInitialEncryptionSetup (): Promise<void> {
    try {
      logger.debug('🔐 === STARTING INITIAL ENCRYPTION SETUP DEBUG ===')

      if (!this.client) {
        logger.debug('🔐 ❌ No client available for initial encryption setup')
        return
      }

      const crypto = this.client.getCrypto()
      if (!crypto) {
        logger.debug('🔐 ❌ No crypto available for initial encryption setup')
        return
      }

      const userId = this.client.getUserId()
      const deviceId = this.client.getDeviceId()

      logger.debug('🔐 Initial setup debug info:', {
        userId: userId || 'MISSING',
        deviceId: deviceId || 'MISSING',
        hasClient: !!this.client,
        hasCrypto: !!crypto
      })

      if (!userId || !deviceId) {
        logger.debug('🔐 ❌ Missing userId or deviceId for initial encryption setup')
        return
      }

      logger.debug('🔐 Checking current encryption state...')

      // Check if this looks like a brand new device that needs setup
      const crossSigningReady = await crypto.isCrossSigningReady().catch((e) => {
        logger.debug('🔐 Error checking crossSigningReady:', e)
        return false
      })

      const deviceStatus = await crypto.getDeviceVerificationStatus(userId, deviceId).catch((e) => {
        logger.debug('🔐 Error checking deviceVerificationStatus:', e)
        return null
      })

      const isDeviceVerified = deviceStatus?.crossSigningVerified || false

      logger.debug('🔐 Current encryption state:', {
        crossSigningReady,
        isDeviceVerified,
        deviceStatus: {
          isVerified: deviceStatus?.isVerified?.() || 'unknown',
          crossSigningVerified: deviceStatus?.crossSigningVerified || false,
          signedByOwner: deviceStatus?.signedByOwner || false
        }
      })

      // Skip setup if encryption is already properly configured
      if (crossSigningReady && isDeviceVerified) {
        logger.debug('🔐 ✅ Encryption already properly set up, skipping initial setup')
        return
      }

      // Check if this is a completely fresh start (no cross-signing at all)
      const hasAnySecrets = await this.client.secretStorage.isStored('m.cross_signing.master').catch((e) => {
        logger.debug('🔐 Error checking secret storage:', e)
        return null
      })

      logger.debug('🔐 Secret storage check:', {
        hasAnySecrets,
        secretStorageAvailable: typeof this.client.secretStorage?.isStored === 'function'
      })

      if (!hasAnySecrets) {
        logger.debug('🔐 🆕 Brand new device detected - performing initial encryption setup')

        // Import and use MatrixEncryptionManager for proper setup
        const { MatrixEncryptionManager } = await import('./MatrixEncryptionManager')
        const encryptionService = new MatrixEncryptionManager(this.client)

        logger.debug('🔐 Starting MatrixEncryptionManager.setupEncryption()...')
        const setupResult = await encryptionService.setupEncryption()

        logger.debug('🔐 Setup result:', {
          success: setupResult.success,
          error: setupResult.error,
          recoveryKey: setupResult.recoveryKey ? '***PROVIDED***' : 'NONE'
        })

        if (setupResult.success) {
          logger.debug('🔐 ✅ Initial encryption setup completed successfully')

          // Store flag to indicate initial setup was completed
          localStorage.setItem('matrix_initial_encryption_setup_completed', Date.now().toString())

          // Also store the recovery key if provided for UI display
          if (setupResult.recoveryKey) {
            logger.debug('🔐 🔑 Storing recovery key for UI display')
            sessionStorage.setItem('matrix_fresh_recovery_key', setupResult.recoveryKey)
          }
        } else {
          logger.warn('🔐 ⚠️ Initial encryption setup failed (non-fatal):', setupResult.error)
        }
      } else {
        logger.debug('🔐 🔑 Existing secrets detected - skipping fresh setup, may need recovery later')
      }

      logger.debug('🔐 === COMPLETED INITIAL ENCRYPTION SETUP DEBUG ===')
    } catch (error) {
      logger.warn('🔐 ⚠️ Initial encryption setup error (non-fatal):', error)
      // Don't throw - this is optional setup that can be done later
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
   * Stop and cleanup Matrix client (for testing)
   */
  public cleanup (): void {
    if (this.client) {
      logger.debug('🧹 Cleaning up Matrix client')
      this.client.stopClient()
      this.client = null
    }
    this.isInitializing = false
    this.initPromise = null
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

        // Try to recover keys using MatrixEncryptionManager
        // Note: Import dynamically to avoid circular dependency
        const { MatrixEncryptionManager } = await import('./MatrixEncryptionManager')
        const encryptionService = new MatrixEncryptionManager(this.client)

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

  /**
   * Format Matrix content URI for display
   */
  public getContentUrl (mxcUrl: string, width?: number, height?: number): string {
    if (!this.client || !mxcUrl.startsWith('mxc://')) return mxcUrl

    try {
      let httpUrl: string | null = null

      // If width/height provided, use thumbnail endpoint; otherwise use download endpoint
      if (width !== undefined && height !== undefined) {
        // Use thumbnail endpoint with dimensions
        httpUrl = this.client.mxcUrlToHttp(mxcUrl, width, height, 'scale')
      } else {
        // Use download endpoint without dimensions for direct file access
        httpUrl = this.client.mxcUrlToHttp(mxcUrl)
      }

      if (!httpUrl) return mxcUrl

      // Transform v3 media URLs to v1 authenticated endpoints for MSC3861/MAS
      if (httpUrl.includes('/_matrix/media/v3/download/')) {
        httpUrl = httpUrl.replace('/_matrix/media/v3/download/', '/_matrix/client/v1/media/download/')
      } else if (httpUrl.includes('/_matrix/media/v3/thumbnail/')) {
        httpUrl = httpUrl.replace('/_matrix/media/v3/thumbnail/', '/_matrix/client/v1/media/thumbnail/')
      }

      return httpUrl
    } catch (error) {
      logger.error('Error formatting content URL:', error)
      return mxcUrl
    }
  }

  /**
   * Send typing notification
   */
  public async sendTyping (roomId: string, isTyping: boolean, timeout?: number): Promise<void> {
    if (!this.client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      await this.client.sendTyping(roomId, isTyping, timeout || 10000)
    } catch (error) {
      logger.error('❌ Failed to send typing notification:', error)
      throw error
    }
  }

  /**
   * Send a message to a room
   */
  public async sendMessage (roomId: string, content: MatrixMessageContent): Promise<{ eventId: string }> {
    if (!this.client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      const result = await this.client.sendEvent(roomId, EventType.RoomMessage, content as RoomMessageEventContent)
      return { eventId: result.event_id }
    } catch (error) {
      logger.error('❌ Failed to send message:', error)
      throw error
    }
  }

  /**
   * Load historical messages for a room
   */
  public async loadRoomHistory (roomId: string, limit = 50): Promise<MatrixEvent[]> {
    if (!this.client) {
      throw new Error('Matrix client not initialized')
    }

    const room = this.client.getRoom(roomId)
    if (!room) {
      throw new Error(`Room not found: ${roomId}`)
    }

    logger.debug(`🔄 Loading room history for ${roomId} with limit ${limit}`)

    try {
      // Get the unfiltered timeline set for full message history
      const timelineSet = room.getUnfilteredTimelineSet()
      const liveTimeline = timelineSet.getLiveTimeline()

      // Paginate backwards to load more messages if needed
      try {
        await this.client.paginateEventTimeline(liveTimeline, { backwards: true, limit })
      } catch (error) {
        // Timeline may not be paginable
        logger.debug('Timeline pagination not available or failed:', error)
      }

      // Get events from the timeline
      const events = liveTimeline.getEvents()

      // Return the most recent events up to the limit
      return events.slice(-limit)
    } catch (error) {
      logger.error('❌ Failed to load room history:', error)
      throw error
    }
  }

  /**
   * Join a room
   */
  public async joinRoom (roomId: string): Promise<Room> {
    if (!this.client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      logger.debug('🚪 Attempting to join room:', roomId)

      // Check if room already exists locally first
      const existingRoom = this.client.getRoom(roomId)
      if (existingRoom) {
        logger.debug('✅ Room already exists locally:', roomId)
        return existingRoom
      }

      logger.debug('🔍 Room not found locally, calling Matrix server to join:', roomId)
      const room = await this.client.joinRoom(roomId)
      logger.debug('🚪 Successfully joined room:', roomId, 'Room ID:', room.roomId)
      return room
    } catch (error) {
      const errorMessage = (error as Error)?.message || 'Unknown error'
      const errorCode = (error as { errcode?: string })?.errcode || 'No error code'

      logger.error('❌ Failed to join room:', roomId)
      logger.error('❌ Error code:', errorCode)
      logger.error('❌ Error message:', errorMessage)
      logger.error('❌ Full error:', error)

      // Log specific error types for debugging
      if (errorCode === 'M_FORBIDDEN') {
        logger.warn('🚫 M_FORBIDDEN: User not invited to room - this should trigger appservice auto-invitation')
      } else if (errorCode === 'M_NOT_FOUND') {
        logger.warn('🔍 M_NOT_FOUND: Room does not exist or user cannot see it')
      }

      throw error
    }
  }

  /**
   * Join an event chat room by event slug using Matrix-native room aliases
   */
  public async joinEventChatRoom (eventSlug: string): Promise<{ room: Room; roomInfo: unknown }> {
    if (!this.client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      logger.debug('🎪 Joining event chat room for event:', eventSlug)

      // Matrix-native approach: Use room aliases instead of backend API calls
      const tenantId = (getEnv('APP_TENANT_ID') as string) || localStorage.getItem('tenantId')
      if (!tenantId) {
        throw new Error('Tenant ID not available')
      }

      // Import room alias utility (assuming it's added to matrixUtils)
      const { generateEventRoomAlias } = await import('../utils/matrixUtils')
      const roomAlias = generateEventRoomAlias(eventSlug, tenantId)

      logger.debug('🏠 Generated room alias:', roomAlias)

      // First, ensure the room exists by querying the alias
      // This will trigger Application Service room creation if the room doesn't exist
      let roomId: string
      try {
        logger.debug('🔍 Resolving room alias to trigger Application Service if needed...')
        const aliasResult = await this.client.getRoomIdForAlias(roomAlias)
        roomId = aliasResult.room_id
        logger.debug('✅ Room alias resolved to room ID:', roomId)
      } catch (aliasError) {
        logger.debug('⚠️ Room alias not found, attempting direct join which may trigger creation')
        // If alias resolution fails, the room might not exist yet
        // Try direct join which might work if Application Service creates it immediately
        roomId = roomAlias // Fallback to using alias as room identifier
      }

      // Now join the room using the resolved room ID or alias
      const room = await this.joinRoom(roomId)

      logger.debug('✅ Joined event chat room via room alias:', roomAlias)
      return {
        room,
        roomInfo: {
          matrixRoomId: room.roomId,
          roomAlias,
          source: 'matrix-native'
        }
      }
    } catch (error) {
      logger.error('❌ Failed to join event chat room:', error)
      throw error
    }
  }

  public hasStoredSession (): boolean {
    try {
      // Get current OpenMeet user for user-specific storage keys
      const authStore = useAuthStore()

      // Wait for auth store to be initialized before checking sessions
      if (!authStore.isInitialized) {
        logger.debug('📱 Auth store not initialized yet, cannot check stored sessions')
        return false
      }

      const openMeetUserSlug = authStore.getUserSlug

      if (!openMeetUserSlug) {
        logger.debug('📱 No user slug available after auth store initialization')
        return false
      }

      // Check for user-specific session data
      const sessionKey = `matrix_session_${openMeetUserSlug}`
      const refreshTokenKey = `matrix_refresh_token_${openMeetUserSlug}`

      const sessionData = localStorage.getItem(sessionKey)
      const refreshToken = localStorage.getItem(refreshTokenKey)

      // We need either session data or refresh token to have a valid session
      return !!(sessionData || refreshToken)
    } catch (error) {
      logger.error('Error checking stored session:', error)
      return false
    }
  }

  public async joinGroupChatRoom (groupSlug: string): Promise<{ room: Room; roomInfo: unknown }> {
    if (!this.client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      logger.debug('👥 Joining group chat room for group:', groupSlug)

      // Matrix-native approach: Use room aliases
      const tenantId = (window as Window & { getEnv?: (key: string) => string }).getEnv?.('APP_TENANT_ID') || localStorage.getItem('tenantId')
      if (!tenantId) {
        throw new Error('Tenant ID not available')
      }

      // Import room alias utility
      const { generateGroupRoomAlias } = await import('../utils/matrixUtils')
      const roomAlias = generateGroupRoomAlias(groupSlug, tenantId)

      logger.debug('🏠 Generated room alias:', roomAlias)

      // Resolve alias and join room
      let roomId: string
      try {
        const aliasResult = await this.client.getRoomIdForAlias(roomAlias)
        roomId = aliasResult.room_id
        logger.debug('✅ Room alias resolved to room ID:', roomId)
      } catch (error) {
        logger.debug('⚠️ Room alias not found, attempting direct join:', roomAlias)
        roomId = roomAlias
      }

      const room = await this.joinRoom(roomId)

      logger.debug('✅ Joined group chat room via room alias:', roomAlias)
      return {
        room,
        roomInfo: {
          matrixRoomId: room.roomId,
          roomAlias,
          source: 'matrix-native'
        }
      }
    } catch (error) {
      logger.error('❌ Failed to join group chat room:', error)
      throw error
    }
  }

  /**
   * Upload file to Matrix media repository
   */
  async uploadFile (file: File): Promise<string> {
    if (!this.client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      logger.debug('🔄 uploadFile: Starting upload to Matrix media repository...')
      logger.debug('🔄 uploadFile: File details:', {
        name: file.name,
        size: file.size,
        type: file.type
      })
      logger.debug('🔄 uploadFile: Matrix client ready, calling uploadContent...')

      const upload = await this.client.uploadContent(file)

      logger.debug('✅ uploadFile: Upload successful!')
      logger.debug('📎 uploadFile: File uploaded with content URI:', upload.content_uri)
      logger.debug('📎 uploadFile: Full upload response:', upload)

      return upload.content_uri
    } catch (error) {
      logger.error('❌ uploadFile: Failed to upload file:', error)

      // Provide more user-friendly error messages for common issues
      if (error instanceof Error) {
        // Check for network/CORS errors that often indicate file size limits or timeouts
        if (error.message === '' && error.stack?.includes('onreadystatechange')) {
          throw new Error('File upload failed - this may be due to file size limits or network timeout')
        }
        throw error
      }
      throw new Error('Unknown error uploading file')
    }
  }

  public async uploadAndSendFile (roomId: string, file: File): Promise<{ eventId: string; url: string }> {
    if (!this.client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      logger.debug('📎 Uploading and sending file:', { roomId, fileName: file.name, fileSize: file.size })

      // Upload file to Matrix media repo
      const uploadResult = await this.client.uploadContent(file, {
        name: file.name,
        type: file.type,
        rawResponse: false
      } as { name: string; type: string; rawResponse: boolean })

      logger.debug('✅ File uploaded:', uploadResult)

      // Determine message type based on file type
      let msgtype = 'm.file'
      if (file.type.startsWith('image/')) {
        msgtype = 'm.image'
      } else if (file.type.startsWith('video/')) {
        msgtype = 'm.video'
      } else if (file.type.startsWith('audio/')) {
        msgtype = 'm.audio'
      }

      // Send message with file
      const content = {
        msgtype,
        body: file.name,
        filename: file.name,
        info: {
          mimetype: file.type,
          size: file.size
        },
        url: uploadResult.content_uri
      }

      // Add image/video specific info
      if (msgtype === 'm.image' || msgtype === 'm.video') {
        // For images/videos, we might want to include dimensions
        // This is optional and would require additional processing
        const extendedInfo = content.info as Record<string, unknown>
        extendedInfo.w = undefined // width would be detected from file
        extendedInfo.h = undefined // height would be detected from file
      }

      const result = await this.sendMessage(roomId, content)

      logger.debug('✅ File message sent:', result)

      return {
        eventId: result.eventId,
        url: uploadResult.content_uri
      }
    } catch (error) {
      logger.error('❌ Failed to upload and send file:', error)
      throw error
    }
  }

  public async clearAllMatrixData (): Promise<void> {
    try {
      logger.debug('🧹 Clearing all Matrix data...')

      // Stop client
      if (this.client) {
        await this.client.stopClient()
      }

      // Clear localStorage Matrix keys
      const keysToRemove = Object.keys(localStorage).filter(key =>
        key.includes('matrix') || key.includes('mx_') || key.includes('oidc')
      )

      keysToRemove.forEach(key => {
        localStorage.removeItem(key)
        logger.debug(`🗑️ Removed localStorage: ${key}`)
      })

      // Clear sessionStorage
      const sessionKeys = Object.keys(sessionStorage).filter(key =>
        key.includes('matrix') || key.includes('mx_') || key.includes('oidc')
      )

      sessionKeys.forEach(key => {
        sessionStorage.removeItem(key)
        logger.debug(`🗑️ Removed sessionStorage: ${key}`)
      })

      // Clear client instance
      this.client = null

      logger.debug('✅ All Matrix data cleared')
    } catch (error) {
      logger.error('❌ Failed to clear Matrix data:', error)
      throw error
    }
  }

  public async forceSyncAfterInvitation (type: 'event' | 'group', identifier: string): Promise<void> {
    if (!this.client) {
      logger.warn('Matrix client not available for force sync')
      return
    }

    try {
      logger.debug(`🔄 Forcing sync after ${type} invitation:`, identifier)

      // Force a sync to ensure we get the latest room state
      await this.client.startClient({ initialSyncLimit: 10 })

      // Wait a bit for sync to complete
      await new Promise(resolve => setTimeout(resolve, 1000))

      logger.debug('✅ Force sync completed')
    } catch (error) {
      logger.error('❌ Force sync failed:', error)
      // Don't throw - this is not critical
    }
  }

  public async joinDirectMessageRoom (matrixUserId: string): Promise<Room> {
    if (!this.client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      logger.debug('💬 Joining direct message room with:', matrixUserId)

      // Create a DM room with the user
      const roomOptions: ICreateRoomOpts = {
        visibility: Visibility.Private,
        is_direct: true,
        invite: [matrixUserId],
        preset: Preset.TrustedPrivateChat
      }
      const room = await this.client.createRoom(roomOptions)

      logger.debug('✅ Created/joined DM room:', room.room_id)
      return this.client.getRoom(room.room_id)!
    } catch (error) {
      logger.error('❌ Failed to join direct message room:', error)
      throw error
    }
  }

  public getReadReceipts (roomId: string, eventId: string): Array<{ userId: string; timestamp: number }> {
    if (!this.client) return []

    try {
      const room = this.client.getRoom(roomId)
      if (!room) return []

      const event = room.findEventById(eventId)
      if (!event) return []

      // Get read receipts for the event
      const receipts = room.getReceiptsForEvent(event)
      return receipts.map((receipt) => ({
        userId: receipt.userId,
        timestamp: receipt.data.ts || 0
      }))
    } catch (error) {
      logger.error('Error getting read receipts:', error)
      return []
    }
  }

  public async sendReadReceipt (roomId: string, eventId: string): Promise<void> {
    if (!this.client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      // Get the room and event to create proper read receipt
      const room = this.client.getRoom(roomId)
      if (!room) {
        throw new Error(`Room ${roomId} not found`)
      }

      const event = room.findEventById(eventId)
      if (!event) {
        logger.warn('Event not found for read receipt:', eventId)
        return
      }

      await this.client.sendReadReceipt(event)
      logger.debug('📖 Read receipt sent for event:', eventId)
    } catch (error) {
      logger.error('❌ Failed to send read receipt:', error)
      throw error
    }
  }

  public async redactMessage (roomId: string, eventId: string, reason?: string): Promise<void> {
    if (!this.client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      logger.debug('🗑️ Redacting message:', eventId, 'in room:', roomId)

      await this.client.redactEvent(roomId, eventId, reason)
      logger.debug('✅ Message redacted successfully')
    } catch (error) {
      logger.error('❌ Failed to redact message:', error)
      throw error
    }
  }

  public needsEncryptionSetup (): boolean {
    if (!this.client) return false

    try {
      // Check if crypto is available and ready
      const crypto = this.client.getCrypto()
      return !crypto || !this.isCryptoReady()
    } catch (error) {
      logger.error('Error checking encryption setup:', error)
      return true
    }
  }

  /**
   * Get OIDC client metadata for dynamic registration
   * Similar to Element Web's PlatformPeg.getOidcClientMetadata()
   */
  private async getOidcClientMetadata (): Promise<{
    clientName: string;
    clientUri: string;
    redirectUris: string[];
    applicationType: 'web' | 'native';
    logoUri?: string;
    contacts: string[];
    tosUri?: string;
    policyUri?: string;
  }> {
    const frontendDomain = window.location.origin
    const redirectPath = getEnv('APP_MAS_REDIRECT_PATH') as string

    // Debug logging to help identify configuration issues
    logger.debug('🔧 OIDC Client Metadata Config:', {
      frontendDomain,
      redirectPath,
      allConfig: getEnv()
    })

    if (!frontendDomain) {
      throw new Error('Missing required environment variable: frontendDomain')
    }

    if (!redirectPath) {
      throw new Error('Missing required environment variable: APP_MAS_REDIRECT_PATH')
    }

    return {
      clientName: 'OpenMeet Platform',
      clientUri: frontendDomain,
      redirectUris: [`${frontendDomain}${redirectPath}`],
      applicationType: 'web' as const,
      logoUri: `${frontendDomain}/openmeet/openmeet-logo.png`,
      contacts: ['support@openmeet.net'],
      tosUri: `${frontendDomain}/terms`,
      policyUri: `${frontendDomain}/privacy`
    }
  }

  /**
   * Get the OIDC client ID for authentication
   * Uses dynamic registration with the Matrix Authentication Service
   * Similar to Element Web's getOidcClientId approach
   */
  private async getOidcClientId (delegatedAuthConfig: OidcClientConfig): Promise<string> {
    try {
      // Use dynamic client registration with MAS
      const clientMetadata = await this.getOidcClientMetadata()
      const clientId = await registerOidcClient(delegatedAuthConfig, clientMetadata as Parameters<typeof registerOidcClient>[1])
      logger.debug(`🔧 Dynamic client registration successful, clientId: ${clientId}`)
      return clientId
    } catch (error) {
      logger.error('❌ Failed to register OIDC client:', error)
      throw new Error(`Failed to register OIDC client: ${error}`)
    }
  }

  /**
   * Start OIDC authentication flow (Element Web pattern)
   * Uses dynamic client registration and Matrix SDK's generateOidcAuthorizationUrl
   */
  public async startAuthenticationFlow (): Promise<MatrixClient | null> {
    try {
      logger.debug('🚀 Starting Matrix OIDC authentication flow...')

      // Get Matrix homeserver URL and discover OIDC config
      const homeserverUrl = getEnv('APP_MATRIX_HOMESERVER_URL') as string

      // Create temporary client to get OIDC metadata (Element Web pattern)
      const tempClient = createClient({ baseUrl: homeserverUrl })
      const delegatedAuthConfig = await tempClient.getAuthMetadata()

      if (!delegatedAuthConfig) {
        throw new Error('Matrix server does not support OIDC authentication')
      }

      // Get dynamic client ID using Element Web's approach
      const clientId = await this.getOidcClientId(delegatedAuthConfig)

      // Get redirect URI
      const redirectPath = getEnv('APP_MAS_REDIRECT_PATH') as string
      const frontendDomain = window.location.origin
      const redirectUri = `${frontendDomain}${redirectPath}`

      // Try to reuse stored device_id to maintain device consistency across sessions
      const storedDeviceId = this.getStoredDeviceId()
      if (storedDeviceId) {
        logger.debug('📱 Found stored device_id for reuse:', storedDeviceId)
      } else {
        logger.debug('📱 No stored device_id found, server will generate new one')
      }

      logger.debug('🔧 OIDC Auth components:', {
        homeserverUrl,
        issuer: delegatedAuthConfig.issuer,
        clientId,
        redirectUri,
        reusingDeviceId: !!storedDeviceId
      })

      // Generate authorization URL with custom device ID scope
      // Use modern OIDC flow consistently for proper state management
      let authorizationUrl: string

      // Always use generateOidcAuthorizationUrl for consistent state storage
      authorizationUrl = await generateOidcAuthorizationUrl({
        metadata: delegatedAuthConfig,
        redirectUri,
        clientId,
        homeserverUrl,
        nonce: Date.now().toString()
      })

      // If we have a stored device ID, modify the URL to include our custom device scope
      if (storedDeviceId) {
        logger.debug('🔧 Modifying OAuth URL to include stored device ID:', storedDeviceId)

        const url = new URL(authorizationUrl)
        const currentScope = url.searchParams.get('scope') || ''

        // Replace any existing device scope with our stored device ID
        const deviceScopePattern = /urn:matrix:org\.matrix\.msc2967\.client:device:[^\s]+/
        let newScope = currentScope

        if (deviceScopePattern.test(currentScope)) {
          // Replace existing device scope
          newScope = currentScope.replace(deviceScopePattern, `urn:matrix:org.matrix.msc2967.client:device:${storedDeviceId}`)
        } else {
          // Add our device scope
          newScope = `${currentScope} urn:matrix:org.matrix.msc2967.client:device:${storedDeviceId}`
        }

        url.searchParams.set('scope', newScope)
        authorizationUrl = url.toString()

        logger.debug('🔧 Modified scope to include stored device ID')
      } else {
        logger.debug('🔧 No stored device ID, using Matrix SDK default scope generation')
      }

      logger.debug('🔗 Generated OIDC auth URL:', authorizationUrl)

      if (typeof window !== 'undefined') {
        // Store current page URL to return after authentication
        sessionStorage.setItem('matrixReturnUrl', window.location.href)
        logger.debug('📍 Stored return URL for post-auth navigation:', window.location.href)

        logger.debug('🌐 Redirecting to OIDC auth URL...')
        window.location.href = authorizationUrl
      } else {
        logger.warn('⚠️ Window not available for redirect')
      }

      return null // Will complete after redirect
    } catch (error) {
      logger.error('❌ Failed to start OIDC authentication flow:', error)
      throw error
    }
  }

  public isRoomEncrypted (roomId: string): boolean {
    if (!this.client) return false

    try {
      const room = this.client.getRoom(roomId)
      if (!room) return false

      return this.client.isRoomEncrypted(roomId)
    } catch (error) {
      logger.error('Error checking room encryption:', error)
      return false
    }
  }

  /**
   * Get user ID and device ID from access token (Element Web pattern)
   * Calls Matrix server's /whoami endpoint to get user details
   */
  private async getUserIdFromAccessToken (accessToken: string, homeserverUrl: string): Promise<{
    user_id: string;
    device_id: string;
    is_guest?: boolean;
  }> {
    const response = await fetch(`${homeserverUrl}/_matrix/client/v3/account/whoami`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to get user info: ${response.statusText}`)
    }

    return await response.json()
  }

  /**
   * Complete OIDC OAuth login using Matrix SDK (Element Web pattern)
   * Uses Matrix SDK's completeAuthorizationCodeGrant + getUserIdFromAccessToken
   */
  public async completeOAuthLogin (code: string, state: string): Promise<MatrixClient> {
    try {
      logger.debug('🔐 Completing OIDC login using Matrix SDK')

      // Use Matrix SDK's completeAuthorizationCodeGrant (Element Web pattern)
      const result = await completeAuthorizationCodeGrant(code, state)

      logger.debug('🔐 Matrix SDK OIDC completion successful')

      // Get user ID and device ID from server (Element Web pattern)
      const userInfo = await this.getUserIdFromAccessToken(
        result.tokenResponse.access_token,
        result.homeserverUrl
      )

      logger.debug('🔐 Retrieved user info from Matrix server:', { userId: userInfo.user_id, deviceId: userInfo.device_id })

      // Extract credentials with proper user and device IDs + OIDC metadata for MatrixTokenManager
      const credentials = {
        homeserverUrl: result.homeserverUrl,
        accessToken: result.tokenResponse.access_token,
        userId: userInfo.user_id,
        deviceId: userInfo.device_id,
        refreshToken: result.tokenResponse.refresh_token,
        // Include OIDC metadata for proper MatrixTokenManager configuration
        oidcIssuer: result.oidcClientSettings?.issuer,
        oidcClientId: result.oidcClientSettings?.clientId,
        oidcRedirectUri: `${window.location.origin}${getEnv('APP_MAS_REDIRECT_PATH')}`,
        idTokenClaims: result.idTokenClaims
      }

      return await this.initializeClientWithCredentials(credentials)
    } catch (error) {
      logger.error('❌ Failed to complete OIDC login:', error)
      throw error
    }
  }
}

// Export singleton instance
export const matrixClientManager = MatrixClientManager.getInstance()
