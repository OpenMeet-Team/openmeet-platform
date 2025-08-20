/**
 * Matrix Device Verification Service
 *
 * Handles incoming verification requests from other devices (mobile apps, etc.)
 * and provides interactive verification flows (QR codes, emoji verification)
 */

import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk'
import { CryptoEvent, VerificationPhase } from 'matrix-js-sdk/lib/crypto-api'
import type { CryptoApi } from 'matrix-js-sdk/lib/crypto-api'
import { logger } from '../utils/logger'

// Type-safe interfaces for verification
interface Verifier {
  start?(): Promise<void>
  verify(): Promise<void>
  cancel(): Promise<void>
  getEmojiSas?(): Array<[string, string]>
  on(event: string, callback: () => void): void
}

interface VerificationRequest {
  transactionId?: string
  otherUserId: string
  otherDeviceId?: string
  methods: string[]
  phase: VerificationPhase
  accept(): Promise<void>
  cancel(): Promise<void>
  beginKeyVerification(method: string): Verifier | null
  on(event: string, callback: () => void): void
  done?: boolean
  cancelled?: boolean
}

interface SyncData {
  to_device?: {
    events: Array<{
      type: string
      sender: string
      content: Record<string, unknown>
    }>
  }
}

export interface VerificationRequestInfo {
  requestId: string
  otherUserId: string
  otherDeviceId: string
  methods: string[]
  timestamp: number
}

export interface EmojiVerificationData {
  emojis: Array<{ emoji: string; name: string }>
  verified: boolean
}

/**
 * Service for handling device verification requests and flows
 */
export class MatrixDeviceVerificationService {
  // TODO: Remove this debug flag once verification is working
  private readonly DEBUG_VERIFICATION = true

  private matrixClient: MatrixClient
  private activeRequests = new Map<string, VerificationRequest>()
  private activeVerifiers = new Map<string, Verifier>()

  // Event listeners for verification notifications
  private verificationRequestListeners: Array<(request: VerificationRequestInfo) => void> = []
  private verificationCompleteListeners: Array<(requestId: string, success: boolean) => void> = []

  constructor (matrixClient: MatrixClient) {
    this.matrixClient = matrixClient
    logger.warn('🔐 MatrixDeviceVerificationService CREATED', {
      userId: matrixClient.getUserId(),
      deviceId: matrixClient.getDeviceId(),
      syncState: matrixClient.getSyncState(),
      hasCrypto: !!matrixClient.getCrypto()
    })

    // Only setup listeners if client is ready, otherwise wait for ready event
    if (matrixClient.getSyncState() === 'SYNCING' || matrixClient.getSyncState() === 'PREPARED') {
      this.setupVerificationListeners()
    } else {
      logger.warn('🔐 Matrix client not ready, waiting for sync...')
      // Listen for when the client becomes ready
      const onClientReady = () => {
        logger.warn('🔐 Matrix client is now ready, setting up verification listeners')
        this.setupVerificationListeners()
        matrixClient.off('sync', onClientReady)
      }
      matrixClient.on('sync', onClientReady)
    }
  }

  /**
   * Safely get verification methods from a request, handling Matrix SDK "not implemented" error
   */
  private getRequestMethods (request: VerificationRequest): string[] {
    try {
      return request.methods || ['m.sas.v1']
    } catch (error) {
      logger.warn('⚠️ Failed to get verification methods, using default:', error.message)
      return ['m.sas.v1']
    }
  }

  /**
   * Start listening for verification requests
   */
  private setupVerificationListeners (): void {
    const crypto = this.matrixClient.getCrypto()
    if (!crypto) {
      logger.warn('Crypto not available for verification listeners')
      return
    }

    logger.warn('🔐 Setting up verification event listeners...')

    // Debug: Log ALL crypto events to see what we're receiving
    const allCryptoEvents = Object.values(CryptoEvent)
    logger.warn('📋 Available CryptoEvent types:', allCryptoEvents)

    // Primary verification listener
    this.matrixClient.on(CryptoEvent.VerificationRequestReceived, this.handleVerificationRequest.bind(this))
    logger.warn('✅ Matrix client VerificationRequestReceived listener set up')

    // Debug: Listen to ALL crypto events to see what we're actually receiving
    allCryptoEvents.forEach(eventType => {
      if (eventType !== CryptoEvent.VerificationRequestReceived) {
        this.matrixClient.on(eventType, (...args) => {
          logger.warn(`🔍 CryptoEvent.${eventType}:`, args.length > 0 ? args : 'no args')
        })
      }
    })

    // Debug: Listen for to-device messages (verification requests come as to-device messages)
    this.matrixClient.on('toDeviceEvent' as string, (event: MatrixEvent) => {
      if (event.getType().includes('verification')) {
        logger.warn('📨 Received verification-related to-device message:', {
          type: event.getType(),
          sender: event.getSender(),
          content: event.getContent()
        })
      }
    })

    // Debug: Listen for all to-device messages during debugging
    this.matrixClient.on('toDeviceEvent' as string, (event: MatrixEvent) => {
      logger.warn('📨 ALL To-device message received:', {
        type: event.getType(),
        sender: event.getSender(),
        recipient: this.matrixClient.getUserId(),
        contentKeys: Object.keys(event.getContent() || {}),
        timestamp: new Date().toISOString()
      })

      // Special attention to verification messages
      if (event.getType().includes('verification')) {
        logger.warn('⚠️ VERIFICATION TO-DEVICE MESSAGE RECEIVED:', {
          type: event.getType(),
          sender: event.getSender(),
          content: event.getContent(),
          isFromDifferentUser: event.getSender() !== this.matrixClient.getUserId()
        })
      }
    })

    // Also listen for sync events to make sure client is syncing
    this.matrixClient.on('sync', (state: string) => {
      if (state === 'PREPARED') {
        logger.warn('🔄 Matrix client sync PREPARED - ready to receive to-device messages')
      }
    })

    // Listen for device verification status changes
    this.matrixClient.on(CryptoEvent.DeviceVerificationChanged, (userId: string, deviceId: string) => {
      logger.warn('🔔 DEVICE VERIFICATION CHANGED:', { userId, deviceId })
    })

    // Listen for user trust status changes (might indicate verification)
    this.matrixClient.on(CryptoEvent.UserTrustStatusChanged, (userId: string, trustLevel: unknown) => {
      logger.warn('🔔 USER TRUST STATUS CHANGED:', { userId, trustLevel })
    })

    // Log current crypto state for debugging
    logger.warn('🔐 Current crypto state:', {
      hasCrypto: !!crypto,
      userId: this.matrixClient.getUserId(),
      deviceId: this.matrixClient.getDeviceId(),
      syncState: this.matrixClient.getSyncState(),
      hasOlmMachine: !!(crypto as CryptoApi)?.olmMachine
    })

    // DEBUG: Log device info for verification target matching
    logger.warn('🎯 VERIFICATION TARGET INFO - Element should send requests to:', {
      targetUserId: this.matrixClient.getUserId(),
      targetDeviceId: this.matrixClient.getDeviceId(),
      fullTarget: `${this.matrixClient.getUserId()}/${this.matrixClient.getDeviceId()}`
    })

    // Debug: Log all our own devices to help with matching
    this.getAllUserDevices().then(devices => {
      logger.warn('📱 Current user devices (total:', devices.length, '):', devices)

      // Specifically highlight the current device
      const currentDevice = devices.find(d => d.isCurrentDevice)
      logger.warn('🎯 CURRENT DEVICE (Element should target this):', currentDevice)

      // Show other devices that Element might mistakenly target
      const otherDevices = devices.filter(d => !d.isCurrentDevice)
      if (otherDevices.length > 0) {
        logger.warn('⚠️ OTHER DEVICES (Element might target these by mistake):', otherDevices.length, 'devices')
        otherDevices.forEach((device, index) => {
          logger.warn(`   ${index + 1}. ${device.deviceId} - ${device.displayName || 'No name'}`)
        })
      }
    }).catch(err => {
      logger.warn('❌ Failed to get user devices:', err)
    })

    // Listen for to-device events - Matrix JS SDK might use different event names
    // Try multiple approaches to catch to-device messages

    // Method 1: Standard to-device event
    try {
      this.matrixClient.on('Room.timeline' as string, (event: MatrixEvent) => {
        if (event.getType()?.includes('m.key.verification')) {
          logger.warn('🔔 ROOM TIMELINE VERIFICATION EVENT:', event.getType(), event.getContent())
        }
      })
    } catch (e) { /* ignore */ }

    // Method 2: Try crypto events on the client directly
    try {
      this.matrixClient.on('event' as string, (event: MatrixEvent) => {
        const eventType = event.getType()
        if (eventType?.includes('m.key.verification')) {
          logger.warn('🔔 GENERAL EVENT VERIFICATION:', eventType, event.getContent())
        }
      })
    } catch (e) { /* ignore */ }

    // Method 3: Listen for sync events that might contain to-device messages
    this.matrixClient.on('sync' as string, (state: string, prevState: string, data: SyncData) => {
      // Log ALL to-device events to see what's coming through
      if (data?.to_device?.events && data.to_device.events.length > 0) {
        logger.warn('🔔 SYNC HAS TO-DEVICE EVENTS:', data.to_device.events.length)
        data.to_device.events.forEach((event: { type: string; sender: string; content: Record<string, unknown> }) => {
          logger.warn('🔔 TO-DEVICE EVENT TYPE:', event.type)
          if (event.type?.includes('verification') || event.type?.includes('key.verification')) {
            logger.warn('🔔 VERIFICATION TO-DEVICE EVENT!', event)
            if (event.type === 'm.key.verification.request') {
              logger.warn('🔔 VERIFICATION REQUEST IN SYNC!', event.content)
              if (event.content && event.content.from_device && event.content.transaction_id) {
                const mockRequest = {
                  transactionId: event.content.transaction_id,
                  otherUserId: event.sender,
                  otherDeviceId: event.content.from_device,
                  methods: event.content.methods || ['m.sas.v1']
                }
                this.handleVerificationRequest(mockRequest as VerificationRequest)
              }
            }
          }
        })
      }
    })

    logger.debug('🔐 Verification listeners setup complete')
  }

  /**
   * Handle incoming verification request from another device
   */
  private handleVerificationRequest (request: VerificationRequest): void {
    const methods = this.getRequestMethods(request)

    logger.warn('🔔 VERIFICATION REQUEST RECEIVED!', {
      requestId: request.transactionId,
      otherUserId: request.otherUserId,
      otherDeviceId: request.otherDeviceId,
      methods,
      timestamp: new Date().toISOString(),
      currentUser: this.matrixClient.getUserId()
    })

    // Store the active request
    this.activeRequests.set(request.transactionId!, request)

    // Create notification info
    const requestInfo: VerificationRequestInfo = {
      requestId: request.transactionId!,
      otherUserId: request.otherUserId,
      otherDeviceId: request.otherDeviceId || 'unknown',
      methods,
      timestamp: Date.now()
    }

    // Notify UI about the verification request
    this.notifyVerificationRequest(requestInfo)

    // Listen for this request being cancelled or completed
    request.on('change', () => {
      if (request.done) {
        this.activeRequests.delete(request.transactionId!)
        this.notifyVerificationComplete(request.transactionId!, !request.cancelled)
      }
    })
  }

  /**
   * Get all pending verification requests
   */
  public getPendingRequests (): VerificationRequestInfo[] {
    logger.warn('🔍 Getting pending verification requests, activeRequests size:', this.activeRequests.size)

    // Also check for verification requests using Matrix SDK methods (like Element Web does)
    this.checkForExistingRequests()

    return Array.from(this.activeRequests.values()).map(request => ({
      requestId: request.transactionId!,
      otherUserId: request.otherUserId,
      otherDeviceId: request.otherDeviceId || 'unknown',
      methods: this.getRequestMethods(request),
      timestamp: Date.now() // Could track actual timestamp if needed
    }))
  }

  /**
   * Clean up stale devices (keep only current device and a few recent ones)
   */
  public async cleanupStaleDevices (keepCount: number = 5): Promise<{success: boolean, deletedCount: number, error?: string}> {
    try {
      const crypto = this.matrixClient.getCrypto()
      if (!crypto) {
        return { success: false, deletedCount: 0, error: 'Crypto not available' }
      }

      const devices = await this.getAllUserDevices()
      const currentDeviceId = this.matrixClient.getDeviceId()

      // Find stale devices (not current device)
      const staleDevices = devices.filter(d => !d.isCurrentDevice && d.deviceId !== currentDeviceId)

      if (staleDevices.length <= keepCount) {
        logger.warn(`📱 Only ${staleDevices.length} stale devices, no cleanup needed (keeping ${keepCount})`)
        return { success: true, deletedCount: 0 }
      }

      // Sort by device ID to have consistent cleanup order
      staleDevices.sort((a, b) => a.deviceId.localeCompare(b.deviceId))

      // Delete oldest devices, keep some recent ones
      const devicesToDelete = staleDevices.slice(0, staleDevices.length - keepCount)

      logger.warn(`🧹 Cleaning up ${devicesToDelete.length} stale devices (keeping ${keepCount} recent + current)`)

      let deletedCount = 0
      for (const device of devicesToDelete) {
        try {
          // Use Matrix client API to delete device
          await this.matrixClient.deleteDevice(device.deviceId, {})
          deletedCount++
          logger.debug(`✅ Deleted stale device: ${device.deviceId}`)
        } catch (error) {
          logger.warn(`⚠️ Failed to delete device ${device.deviceId}:`, error)
          // Continue with other devices even if one fails
        }
      }

      logger.warn(`✅ Cleaned up ${deletedCount}/${devicesToDelete.length} stale devices`)
      return { success: true, deletedCount }
    } catch (error) {
      logger.error('❌ Failed to cleanup stale devices:', error)
      return { success: false, deletedCount: 0, error: String(error) }
    }
  }

  /**
   * Get all devices for the current user
   */
  public async getAllUserDevices (): Promise<Array<{deviceId: string, displayName?: string, isCurrentDevice: boolean}>> {
    try {
      const crypto = this.matrixClient.getCrypto()
      if (!crypto) return []

      const userId = this.matrixClient.getUserId()!
      const currentDeviceId = this.matrixClient.getDeviceId()!

      logger.warn('🔍 Getting all devices for user:', userId)

      // Get devices using Matrix SDK
      const devices = await crypto.getUserDeviceInfo([userId])
      const userDevices = devices.get(userId)

      if (!userDevices) return []

      const deviceList = Array.from(userDevices.entries()).map(([deviceId, device]) => ({
        deviceId,
        displayName: device.displayName || `Device ${deviceId}`,
        isCurrentDevice: deviceId === currentDeviceId
      }))

      logger.warn('🔍 Found devices:', deviceList)
      return deviceList
    } catch (error) {
      logger.error('Failed to get user devices:', error)
      return []
    }
  }

  /**
   * Initiate verification with a specific device
   */
  public async requestVerificationWithDevice (deviceId: string): Promise<{ success: boolean; error?: string; requestId?: string }> {
    try {
      const crypto = this.matrixClient.getCrypto()
      if (!crypto) {
        return { success: false, error: 'Crypto not available' }
      }

      const userId = this.matrixClient.getUserId()!

      logger.warn('🔐 Requesting verification with device:', { userId, deviceId })

      // Check for existing verification request for this device
      for (const [requestId, existingRequest] of Array.from(this.activeRequests.entries())) {
        if (existingRequest.otherUserId === userId && existingRequest.otherDeviceId === deviceId) {
          logger.warn('⚠️ Existing verification request found for this device:', { requestId, phase: existingRequest.phase })

          // If request is still pending, return the existing one
          if (existingRequest.phase === VerificationPhase.Requested || existingRequest.phase === VerificationPhase.Ready) {
            return { success: true, requestId }
          }

          // If request is in other states, clean it up first
          logger.warn('🧹 Cleaning up stale verification request:', { requestId, phase: existingRequest.phase })
          this.activeRequests.delete(requestId)
          this.activeVerifiers.delete(requestId)
        }
      }

      // Use Matrix SDK to request verification
      const request = await crypto.requestDeviceVerification(userId, deviceId)

      if (request) {
        logger.warn('✅ Verification request created:', request)

        // Store the request
        this.activeRequests.set(request.transactionId!, request as VerificationRequest)

        // Notify listeners
        const requestInfo: VerificationRequestInfo = {
          requestId: request.transactionId!,
          otherUserId: userId,
          otherDeviceId: deviceId,
          methods: ['m.sas.v1'],
          timestamp: Date.now()
        }
        this.notifyVerificationRequest(requestInfo)

        return { success: true, requestId: request.transactionId! }
      } else {
        return { success: false, error: 'Failed to create verification request' }
      }
    } catch (error) {
      logger.error('Failed to request device verification:', error)
      return { success: false, error: (error as Error).message || 'Failed to request verification' }
    }
  }

  /**
   * Check for existing verification requests using Matrix SDK methods
   */
  private checkForExistingRequests (): void {
    try {
      const crypto = this.matrixClient.getCrypto()
      if (!crypto) return

      logger.warn('🔍 Checking for existing verification requests via Matrix SDK...')

      // Try to find DM verification requests (Element Web pattern)
      const userId = this.matrixClient.getUserId()!
      const rooms = this.matrixClient.getRooms()

      for (const room of rooms) {
        try {
          // Check all rooms, not just DMs - verification might work differently
          const dmMembers = room.getMembers()
          logger.debug('🔍 Checking room for verification requests:', {
            roomId: room.roomId,
            memberCount: dmMembers.length,
            roomName: room.name
          })

          for (const member of dmMembers) {
            if (member.userId !== userId) {
              try {
                const request = crypto.findVerificationRequestDMInProgress(room.roomId, member.userId)
                if (request) {
                  logger.warn('🔔 FOUND EXISTING VERIFICATION REQUEST!', {
                    roomId: room.roomId,
                    otherUserId: member.userId,
                    request
                  })
                  this.handleVerificationRequest(request as VerificationRequest)
                }
              } catch (findError) {
                logger.debug('No verification request for user:', member.userId, findError)
              }
            }
          }
        } catch (error) {
          logger.debug('Error checking room for verification:', room.roomId, error)
        }
      }
    } catch (error) {
      logger.warn('Error checking for existing verification requests:', error)
    }
  }

  /**
   * Accept a verification request and start the verification process
   */
  public async acceptVerificationRequest (requestId: string, method: string = 'm.sas.v1'): Promise<{ success: boolean; verifier?: Verifier; error?: string }> {
    try {
      const request = this.activeRequests.get(requestId)
      if (!request) {
        return { success: false, error: 'Verification request not found' }
      }

      logger.debug('🔐 Accepting verification request:', { requestId, method, phase: request.phase })
      logger.debug('🔍 VerificationPhase constants:', {
        Requested: VerificationPhase.Requested,
        Ready: VerificationPhase.Ready,
        Started: VerificationPhase.Started,
        Cancelled: VerificationPhase.Cancelled,
        Done: VerificationPhase.Done
      })

      // Handle different verification phases
      if (request.phase === VerificationPhase.Requested) {
        logger.debug('📤 Calling request.accept() - phase is Requested')
        await request.accept()
        logger.debug('✅ Verification request accepted successfully')
      } else if (request.phase === VerificationPhase.Ready) {
        logger.debug('ℹ️ Verification request already accepted, proceeding to start verification')
      } else if (request.phase === VerificationPhase.Started) {
        logger.debug('🔄 Verification already started, proceeding with existing verification')
        // Check if we already have a verifier for this request
        const existingVerifier = this.activeVerifiers.get(requestId)
        if (existingVerifier) {
          logger.debug('✅ Found existing verifier for started verification')
          return { success: true, verifier: existingVerifier }
        }
      } else if (request.phase === VerificationPhase.Done) {
        logger.debug('✅ Verification already completed')
        return { success: true, verifier: null }
      } else if (request.phase === VerificationPhase.Cancelled) {
        logger.debug('❌ Verification was cancelled')
        return { success: false, error: 'Verification request was cancelled' }
      } else {
        logger.debug('❌ Unknown verification phase:', request.phase)
        return { success: false, error: `Unknown verification phase: ${request.phase}` }
      }

      // Start verification with the specified method
      let verifier
      try {
        verifier = request.beginKeyVerification(method)
      } catch (error) {
        if (error.message === 'not implemented') {
          logger.warn('⚠️ beginKeyVerification failed with "not implemented", trying alternative approach')
          // Try to work around the SDK issue by creating verifier differently
          try {
            // Alternative: try to access the verification methods safely first
            const safeMethods = this.getRequestMethods(request)
            logger.debug('🔧 Safe methods retrieved:', safeMethods)
            verifier = request.beginKeyVerification(method)
          } catch (retryError) {
            logger.error('❌ Alternative verification approach failed:', retryError)
            return { success: false, error: `Verification failed: ${retryError.message}` }
          }
        } else {
          throw error // Re-throw if it's a different error
        }
      }

      if (!verifier) {
        return { success: false, error: 'Failed to create verifier' }
      }

      // Store the verifier for ongoing verification
      this.activeVerifiers.set(requestId, verifier)

      // Set up verifier event listeners
      this.setupVerifierListeners(requestId, verifier)

      // Start the verification process if method exists
      if (verifier.start) {
        await verifier.start()
      }

      return { success: true, verifier }
    } catch (error) {
      logger.error('Failed to accept verification request:', error)
      return { success: false, error: (error as Error).message || 'Failed to accept verification' }
    }
  }

  /**
   * Reject a verification request
   */
  public async rejectVerificationRequest (requestId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const request = this.activeRequests.get(requestId)
      if (!request) {
        return { success: false, error: 'Verification request not found' }
      }

      logger.debug('❌ Rejecting verification request:', requestId)

      await request.cancel()
      this.activeRequests.delete(requestId)

      return { success: true }
    } catch (error) {
      logger.error('Failed to reject verification request:', error)
      return { success: false, error: (error as Error).message || 'Failed to reject verification' }
    }
  }

  /**
   * Get emoji verification data for ongoing verification
   */
  public getEmojiVerification (requestId: string): EmojiVerificationData | null {
    const verifier = this.activeVerifiers.get(requestId)
    if (!verifier || !verifier.getEmojiSas) {
      return null
    }

    try {
      const sasData = verifier.getEmojiSas()
      if (!sasData) return null

      return {
        emojis: sasData.map(item => ({
          emoji: item[0], // The emoji character
          name: item[1] // The emoji name
        })),
        verified: false
      }
    } catch (error) {
      logger.warn('Failed to get emoji verification data:', error)
      return null
    }
  }

  /**
   * Confirm emoji verification matches
   */
  public async confirmEmojiVerification (requestId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const verifier = this.activeVerifiers.get(requestId)
      if (!verifier) {
        return { success: false, error: 'Verifier not found' }
      }

      logger.debug('✅ Confirming emoji verification:', requestId)
      await verifier.verify()

      return { success: true }
    } catch (error) {
      logger.error('Failed to confirm emoji verification:', error)
      return { success: false, error: (error as Error).message || 'Failed to confirm verification' }
    }
  }

  /**
   * Cancel ongoing verification
   */
  public async cancelVerification (requestId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const verifier = this.activeVerifiers.get(requestId)
      if (verifier) {
        await verifier.cancel()
        this.activeVerifiers.delete(requestId)
      }

      const request = this.activeRequests.get(requestId)
      if (request) {
        await request.cancel()
        this.activeRequests.delete(requestId)
      }

      return { success: true }
    } catch (error) {
      logger.error('Failed to cancel verification:', error)
      return { success: false, error: (error as Error).message || 'Failed to cancel verification' }
    }
  }

  /**
   * Set up event listeners for verifier
   */
  private setupVerifierListeners (requestId: string, verifier: Verifier): void {
    try {
      verifier.on('show_sas', () => {
        logger.debug('🔐 SAS verification ready for:', requestId)
        // UI should now show the emoji comparison
      })

      verifier.on('verify', () => {
        logger.debug('✅ Verification completed successfully:', requestId)
        this.activeVerifiers.delete(requestId)
        this.activeRequests.delete(requestId)
        this.notifyVerificationComplete(requestId, true)
      })

      verifier.on('cancel', () => {
        logger.debug('❌ Verification cancelled:', requestId)
        this.activeVerifiers.delete(requestId)
        this.activeRequests.delete(requestId)
        this.notifyVerificationComplete(requestId, false)
      })
    } catch (error) {
      logger.warn('Failed to set up verifier listeners:', error)
    }
  }

  /**
   * Add listener for verification requests
   */
  public onVerificationRequest (listener: (request: VerificationRequestInfo) => void): void {
    this.verificationRequestListeners.push(listener)
  }

  /**
   * Add listener for verification completion
   */
  public onVerificationComplete (listener: (requestId: string, success: boolean) => void): void {
    this.verificationCompleteListeners.push(listener)
  }

  /**
   * Remove all listeners (cleanup)
   */
  public removeAllListeners (): void {
    this.verificationRequestListeners = []
    this.verificationCompleteListeners = []

    // Clean up Matrix SDK listeners
    this.matrixClient.off(CryptoEvent.VerificationRequestReceived, this.handleVerificationRequest.bind(this))
  }

  /**
   * Notify UI about new verification request
   */
  private notifyVerificationRequest (request: VerificationRequestInfo): void {
    this.verificationRequestListeners.forEach(listener => {
      try {
        listener(request)
      } catch (error) {
        logger.warn('Verification request listener error:', error)
      }
    })
  }

  /**
   * Notify UI about verification completion
   */
  private notifyVerificationComplete (requestId: string, success: boolean): void {
    this.verificationCompleteListeners.forEach(listener => {
      try {
        listener(requestId, success)
      } catch (error) {
        logger.warn('Verification complete listener error:', error)
      }
    })
  }

  /**
   * Clean up resources
   */
  public destroy (): void {
    this.removeAllListeners()
    this.activeRequests.clear()
    this.activeVerifiers.clear()
  }
}
