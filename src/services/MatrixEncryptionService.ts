import { logger } from '../utils/logger'
import { matrixClientManager } from './MatrixClientManager'
import { matrixClientService } from './matrixClientService'

/**
 * MatrixEncryptionService - Background encryption initialization and management
 *
 * This service handles encryption as a progressive enhancement, separate from basic Matrix connection.
 * It allows chat to work immediately while encryption loads in the background.
 */
export class MatrixEncryptionService {
  // eslint-disable-next-line no-use-before-define
  private static instance: MatrixEncryptionService
  private initializationAttempted = false
  private initializationInProgress = false
  private initializationPromise: Promise<boolean> | null = null

  public static getInstance (): MatrixEncryptionService {
    if (!MatrixEncryptionService.instance) {
      MatrixEncryptionService.instance = new MatrixEncryptionService()
    }
    return MatrixEncryptionService.instance
  }

  /**
   * Check if encryption is available and ready
   */
  public isEncryptionReady (): boolean {
    return matrixClientManager.isCryptoReady()
  }

  /**
   * Check if encryption is currently being initialized
   */
  public isEncryptionInitializing (): boolean {
    return matrixClientManager.isCryptoInitializing() || this.initializationInProgress
  }

  /**
   * Initialize encryption in the background (non-blocking)
   * Returns immediately with current status, starts initialization if needed
   */
  public async initializeEncryptionBackground (): Promise<boolean> {
    // Return current status if already ready
    if (this.isEncryptionReady()) {
      logger.debug('🔐 Encryption already ready')
      return true
    }

    // Start initialization if not already started
    if (!this.initializationAttempted && !this.initializationInProgress) {
      logger.debug('🔐 Starting background encryption initialization...')
      this.startBackgroundInitialization()
    }

    // Return current status (may still be initializing)
    return this.isEncryptionReady()
  }

  /**
   * Initialize encryption and wait for completion (blocking)
   * Use this when encryption is specifically needed
   */
  public async initializeEncryptionBlocking (): Promise<boolean> {
    // Return current status if already ready
    if (this.isEncryptionReady()) {
      logger.debug('🔐 Encryption already ready')
      return true
    }

    // Wait for ongoing initialization if in progress
    if (this.initializationInProgress && this.initializationPromise) {
      logger.debug('🔄 Waiting for ongoing encryption initialization...')
      return await this.initializationPromise
    }

    // Start new initialization and wait for it
    logger.debug('🔐 Starting blocking encryption initialization...')
    return await this.startBlockingInitialization()
  }

  /**
   * Start encryption initialization in background (fire and forget)
   */
  private startBackgroundInitialization (): void {
    this.initializationAttempted = true
    this.initializationInProgress = true

    // Start initialization but don't await it
    this.performEncryptionInitialization()
      .then(success => {
        logger.debug(success ? '✅ Background encryption initialization completed' : '❌ Background encryption initialization failed')
      })
      .catch(error => {
        logger.warn('⚠️ Background encryption initialization error:', error)
      })
      .finally(() => {
        this.initializationInProgress = false
      })
  }

  /**
   * Start encryption initialization and return promise (blocking)
   */
  private async startBlockingInitialization (): Promise<boolean> {
    this.initializationAttempted = true
    this.initializationInProgress = true
    this.initializationPromise = this.performEncryptionInitialization()

    try {
      const success = await this.initializationPromise
      logger.debug(success ? '✅ Blocking encryption initialization completed' : '❌ Blocking encryption initialization failed')
      return success
    } catch (error) {
      logger.error('❌ Blocking encryption initialization error:', error)
      return false
    } finally {
      this.initializationInProgress = false
      this.initializationPromise = null
    }
  }

  /**
   * Perform the actual encryption initialization
   */
  private async performEncryptionInitialization (): Promise<boolean> {
    try {
      // Ensure basic Matrix client is ready
      if (!matrixClientService.isReady()) {
        logger.warn('⚠️ Basic Matrix client not ready for encryption initialization')
        return false
      }

      // Get user info for crypto initialization
      const client = matrixClientService.getClient()
      if (!client) {
        logger.error('❌ Matrix client not available for encryption initialization')
        return false
      }

      const userId = client.getUserId()
      const deviceId = client.getDeviceId()

      // Initialize crypto through MatrixClientManager
      logger.debug('🔐 Initializing crypto through MatrixClientManager...')
      const success = await matrixClientManager.initializeCrypto(userId || undefined, deviceId || undefined)

      if (success) {
        logger.debug('✅ Encryption initialization successful')
        this.emitEncryptionReady()
        return true
      } else {
        logger.warn('⚠️ Encryption initialization failed, continuing with unencrypted chat')
        this.emitEncryptionFailed()
        return false
      }
    } catch (error) {
      logger.error('❌ Encryption initialization error:', error)
      this.emitEncryptionFailed()
      return false
    }
  }

  /**
   * Emit encryption ready event for UI components
   */
  private emitEncryptionReady (): void {
    logger.debug('📢 Emitting encryption ready event')
    window.dispatchEvent(new CustomEvent('matrix-encryption-ready', {
      detail: { ready: true }
    }))
  }

  /**
   * Emit encryption failed event for UI components
   */
  private emitEncryptionFailed (): void {
    logger.debug('📢 Emitting encryption failed event')
    window.dispatchEvent(new CustomEvent('matrix-encryption-failed', {
      detail: { error: 'Encryption initialization failed' }
    }))
  }

  /**
   * Get encryption status for UI display
   */
  public getEncryptionStatus (): {
    ready: boolean
    initializing: boolean
    attempted: boolean
    available: boolean
    } {
    return {
      ready: this.isEncryptionReady(),
      initializing: this.isEncryptionInitializing(),
      attempted: this.initializationAttempted,
      available: matrixClientService.isReady() // Basic client must be ready for encryption to be possible
    }
  }

  /**
   * Reset encryption service state (for testing or reconnection)
   */
  public reset (): void {
    logger.debug('🔄 Resetting encryption service state')
    this.initializationAttempted = false
    this.initializationInProgress = false
    this.initializationPromise = null
  }
}

// Export singleton instance
export const matrixEncryptionService = MatrixEncryptionService.getInstance()
