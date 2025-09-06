/**
 * Unified Matrix Device Manager
 *
 * Consolidates all Matrix device-related functionality including:
 * - Device verification and cross-signing
 * - Device setup and bootstrapping
 * - Device management operations
 * - Device verification utilities
 * - Trust management and persistence
 *
 * This service replaces:
 * - MatrixDeviceVerificationService
 * - MatrixDeviceSetup
 * - Original MatrixDeviceManager
 * - deviceVerificationHelper utilities
 */

import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk'
import { ClientEvent } from 'matrix-js-sdk'
import { CryptoEvent, VerificationPhase } from 'matrix-js-sdk/lib/crypto-api'
import { logger } from '../utils/logger'

// Type-safe interfaces for verification
interface Verifier {
  start?(): Promise<void>
  verify(): Promise<void>
  cancel(): Promise<void>
  getEmojiSas?(): Array<[string, string]>
  getEmoji?(): Array<[string, string]>
  emojis?: Array<[string, string]>
  sas?: { emoji?: Array<[string, string]> }
  getSas?(): { emoji?: Array<[string, string]> }
  on(event: string, callback: () => void): void
  constructor: { name: string }
  [key: string]: unknown
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
  startVerification?(method: string): Promise<Verifier>
  on(event: string, callback: () => void): void
  done?: boolean
  cancelled?: boolean
  verifier?: Verifier
  getVerifier?(): Verifier | null
  _verifier?: Verifier
}

// Extended device info interface to handle Matrix SDK's incomplete types
interface ExtendedDeviceInfo {
  displayName?: string
  verified: boolean | object
  lastSeenTs?: number
}

// Public interfaces
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

export interface DeviceInfo {
  deviceId: string
  displayName: string
  isVerified: boolean
  isCurrentDevice: boolean
  isTrusted: boolean
  isOpenMeetClient: boolean
  lastSeen: number
  verificationMethod?: string
}

export interface DeviceVerificationRequest {
  deviceId: string
  verificationMethod: 'qr-code' | 'emoji-verification' | 'security-key'
  requestId: string
}

export interface DeviceSetupResult {
  success: boolean
  error?: string
  step?: string
  recoveryKey?: string
  deviceId?: string
}

/**
 * Unified Matrix Device Manager
 *
 * Handles all device-related operations including verification, setup, management, and utilities
 */
export class MatrixDeviceManager {
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
    logger.warn('🔐 MatrixDeviceManager CREATED', {
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
        matrixClient.off(ClientEvent.Sync, onClientReady)
      }
      matrixClient.on(ClientEvent.Sync, onClientReady)
    }
  }

  // ============================================================================
  // DEVICE VERIFICATION WORKFLOWS
  // ============================================================================

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
    this.matrixClient.on(ClientEvent.ToDeviceEvent, (event: MatrixEvent) => {
      if (event.getType().includes('verification')) {
        logger.warn('📨 Received verification-related to-device message:', {
          type: event.getType(),
          sender: event.getSender(),
          content: event.getContent()
        })
      }
    })

    // Debug: Listen for all to-device messages during debugging
    this.matrixClient.on(ClientEvent.ToDeviceEvent, (event: MatrixEvent) => {
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
    this.matrixClient.on(ClientEvent.Sync, (state: string) => {
      if (state === 'PREPARED') {
        logger.warn('🔄 Matrix client sync PREPARED - ready to receive to-device messages')
      }
    })

    // Listen for device verification status changes
    // Note: DeviceVerificationChanged doesn't exist in current CryptoEvent enum
    // Using UserTrustStatusChanged instead
    this.matrixClient.on(CryptoEvent.UserTrustStatusChanged, (userId: string, trustLevel: unknown) => {
      logger.warn('🔐 USER TRUST STATUS CHANGED:', { userId, trustLevel })
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
      hasOlmMachine: !!crypto
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

    // Method 1: Standard room timeline events
    try {
      this.matrixClient.on(ClientEvent.Event, (event: MatrixEvent) => {
        if (event.getType()?.includes('m.key.verification')) {
          logger.warn('🔔 ROOM TIMELINE VERIFICATION EVENT:', event.getType(), event.getContent())
        }
      })
    } catch (e) { /* ignore */ }

    // Method 2: Try general events on the client directly
    try {
      this.matrixClient.on(ClientEvent.Event, (event: MatrixEvent) => {
        const eventType = event.getType()
        if (eventType?.includes('m.key.verification')) {
          logger.warn('🔔 GENERAL EVENT VERIFICATION:', eventType, event.getContent())
        }
      })
    } catch (e) { /* ignore */ }

    // Method 3: Listen for sync events that might contain to-device messages
    this.matrixClient.on(ClientEvent.Sync, (state: string, prevState: string, data: unknown) => {
      // Log ALL to-device events to see what's coming through
      const syncData = data as { to_device?: { events: Array<{ type: string; sender: string; content: Record<string, unknown> }> } }
      if (syncData?.to_device?.events && syncData.to_device.events.length > 0) {
        logger.warn('🔔 SYNC HAS TO-DEVICE EVENTS:', syncData.to_device.events.length)
        syncData.to_device.events.forEach((event: { type: string; sender: string; content: Record<string, unknown> }) => {
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

    // Check if we already have this request to prevent duplicates
    const existingRequest = this.activeRequests.get(request.transactionId!)
    if (existingRequest) {
      logger.debug('⚠️ Duplicate verification request ignored:', request.transactionId)
      return // Don't process duplicates
    }

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

    // Auto-accept verification requests to prevent timeout (Element Web pattern)
    // Only auto-accept if in the correct phase
    if (request.phase === VerificationPhase.Requested) {
      logger.warn('🚀 Auto-accepting verification request to prevent timeout (phase: Requested)')

      // Accept the request immediately
      request.accept().then(() => {
        logger.warn('✅ Verification request auto-accepted successfully')
        this.notifyVerificationRequest(requestInfo)
      }).catch((error) => {
        logger.error('❌ Failed to auto-accept verification request:', error)
        // Still notify UI even if auto-accept failed
        this.notifyVerificationRequest(requestInfo)
      })
    } else {
      // For other phases, notify immediately
      logger.debug(`ℹ️ Verification request in phase ${request.phase}, not auto-accepting`)
      this.notifyVerificationRequest(requestInfo)
    }

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
                  this.handleVerificationRequest(request as unknown as VerificationRequest)
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

        // Store the request (with proper typing)
        this.activeRequests.set(request.transactionId!, request as unknown as VerificationRequest)

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

        // Try to find the verifier from the request object (Matrix JS SDK v37+ pattern)
        try {
          const requestVerifier = request.verifier || request.getVerifier?.() || request._verifier
          if (requestVerifier) {
            logger.debug('🔍 Found verifier from request object for started verification')
            this.activeVerifiers.set(requestId, requestVerifier)
            this.setupVerifierListeners(requestId, requestVerifier)
            return { success: true, verifier: requestVerifier }
          } else {
            logger.debug('⚠️ No verifier found in request object, will try to create one')
          }
        } catch (error) {
          logger.warn('⚠️ Could not access verifier from started request:', error)
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
      // Modern Matrix JS SDK v37+ uses different verification API
      let verifier
      try {
        // Try modern API first (Matrix JS SDK v37+)
        if (typeof request.startVerification === 'function') {
          logger.debug('🔧 Using modern startVerification API')
          verifier = await request.startVerification(method)
        } else if (typeof request.beginKeyVerification === 'function') {
          logger.debug('🔧 Using legacy beginKeyVerification API')
          verifier = request.beginKeyVerification(method)
        } else {
          // Try direct crypto API access (Element Web pattern)
          logger.debug('🔧 Trying direct crypto API access')
          const crypto = this.matrixClient.getCrypto()
          if (crypto && typeof crypto.requestVerificationDM === 'function') {
            // This might be a different approach - for now, return error
            return { success: false, error: 'Verification API not compatible - try updating Matrix JS SDK' }
          }
        }
      } catch (error) {
        if (error.message?.includes('not implemented')) {
          logger.warn('⚠️ Verification API not implemented in this Matrix JS SDK version')
          return { success: false, error: 'Device verification not supported in this Matrix JS SDK version. Please try refreshing or updating.' }
        } else {
          logger.error('❌ Verification start failed:', error)
          return { success: false, error: `Verification failed: ${error.message}` }
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
    // Log all available methods for debugging Matrix JS SDK v37+ RustSASVerifier
    if (verifier) {
      const allMethods = [
        ...Object.getOwnPropertyNames(verifier),
        ...Object.getOwnPropertyNames(Object.getPrototypeOf(verifier))
      ].filter(name => typeof (verifier as Record<string, unknown>)[name] === 'function')

      // Log methods explicitly since console might truncate arrays
      logger.debug('🔍 Getting emoji verification for:', requestId)
      logger.debug('📋 Verifier type:', verifier.constructor.name)
      logger.debug('📋 Available methods:', allMethods)
      logger.debug('🔍 Emoji method tests:', {
        hasGetEmojiSas: !!verifier.getEmojiSas,
        hasGetEmoji: !!verifier.getEmoji,
        hasEmojis: !!verifier.emojis,
        hasSas: !!verifier.sas,
        hasGetSas: !!verifier.getSas
      })
    } else {
      logger.warn('⚠️ No verifier found for requestId:', requestId)
      return null
    }

    if (!verifier.getEmojiSas) {
      logger.warn('⚠️ Verifier has no getEmojiSas method:', requestId)
      // Try all possible Matrix JS SDK v37+ RustSASVerifier emoji method patterns
      const possibleMethods = [
        'getSasEmojis',
        'getEmoji',
        'emojis',
        'sas',
        'getSas',
        'sasEmojis',
        'getEmojiSAS',
        'getShortAuthenticationString',
        'shortAuthenticationString'
      ]

      for (const methodName of possibleMethods) {
        const method = (verifier as Record<string, unknown>)[methodName]
        if (method) {
          logger.debug(`🔧 Found alternative emoji method: ${methodName}`)
          try {
            const sasData = typeof method === 'function' ? method() : method
            logger.debug('🔍 Raw SAS data from', methodName, ':', sasData)

            if (sasData && Array.isArray(sasData)) {
              return {
                emojis: sasData.map((item: [string, string] | { emoji?: string; symbol?: string; name?: string; description?: string }) => ({
                  emoji: Array.isArray(item) ? item[0] : (item.emoji || item.symbol || ''),
                  name: Array.isArray(item) ? item[1] : (item.name || item.description || '')
                })),
                verified: false
              }
            } else if (sasData && typeof sasData === 'object') {
              // Handle object format
              if (sasData.emojis && Array.isArray(sasData.emojis)) {
                return {
                  emojis: sasData.emojis.map((item: [string, string] | { emoji?: string; symbol?: string; name?: string; description?: string }) => ({
                    emoji: Array.isArray(item) ? item[0] : (item.emoji || item.symbol || ''),
                    name: Array.isArray(item) ? item[1] : (item.name || item.description || '')
                  })),
                  verified: false
                }
              }
            }
          } catch (error) {
            logger.warn(`⚠️ Method ${methodName} failed:`, error)
          }
        }
      }
      return null
    }

    try {
      const sasData = verifier.getEmojiSas()
      logger.debug('🔍 Raw SAS data:', sasData)

      if (!sasData) {
        logger.warn('⚠️ getEmojiSas returned null/undefined')
        return null
      }

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

        // Try to get emoji data now that SAS is ready using all possible methods
        logger.debug('🔐 show_sas event fired, attempting to access emoji data')

        // First, let's inspect what's available on the verifier now
        const allMethods = [
          ...Object.getOwnPropertyNames(verifier),
          ...Object.getOwnPropertyNames(Object.getPrototypeOf(verifier))
        ].filter(name => typeof (verifier as Record<string, unknown>)[name] === 'function')

        logger.debug('🔍 Methods available in show_sas:', allMethods)

        // Try all possible ways to access emoji data
        const possibleMethods = [
          'getEmojiSas', 'getSasEmojis', 'getEmoji', 'emojis', 'sas', 'getSas',
          'sasEmojis', 'getEmojiSAS', 'getShortAuthenticationString', 'shortAuthenticationString'
        ]

        let foundEmojiData = false
        for (const methodName of possibleMethods) {
          const method = (verifier as Record<string, unknown>)[methodName]
          if (method) {
            try {
              const sasData = typeof method === 'function' ? method() : method
              if (sasData) {
                logger.debug(`✅ Found emoji data via ${methodName}:`, sasData)
                foundEmojiData = true
                break
              }
            } catch (error) {
              logger.debug(`⚠️ Method ${methodName} failed:`, error.message)
            }
          }
        }

        if (!foundEmojiData) {
          logger.warn('⚠️ No emoji data accessible even after show_sas event')
          // Try to inspect the verifier object structure
          logger.debug('🔍 Verifier object keys:', Object.keys(verifier))
          logger.debug('🔍 Verifier properties:', Object.getOwnPropertyNames(verifier))
        }
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

  // ============================================================================
  // DEVICE SETUP AND BOOTSTRAPPING
  // ============================================================================

  /**
   * Set up cross-signing for the main OpenMeet device
   * This should be called once per user account
   */
  public async setupMainDevice (): Promise<DeviceSetupResult> {
    try {
      logger.debug('🔐 Setting up main OpenMeet device with cross-signing...')

      // First, set up encryption with cross-signing
      const { MatrixEncryptionService } = await import('./MatrixEncryptionManager')
      const encryptionService = new MatrixEncryptionService(this.matrixClient)
      const setupResult = await encryptionService.setupEncryption('default-passphrase')

      if (!setupResult.success) {
        return {
          success: false,
          error: setupResult.error,
          step: 'encryption-setup'
        }
      }

      // Device verification is now handled automatically by MatrixEncryptionService
      logger.debug('✅ Encryption setup completed with automatic device verification')

      const userId = this.matrixClient.getUserId()
      const deviceId = this.matrixClient.getDeviceId()

      logger.debug('✅ Main OpenMeet device setup completed', { userId, deviceId })

      return {
        success: true,
        recoveryKey: setupResult.recoveryKey,
        deviceId: deviceId || undefined
      }
    } catch (error) {
      logger.error('❌ Failed to setup main device:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        step: 'main-device-setup'
      }
    }
  }

  /**
   * Prepare the main device to verify additional devices
   * This ensures cross-signing is ready for verifying other devices
   */
  public async prepareForAdditionalDevices (): Promise<DeviceSetupResult> {
    try {
      const crypto = this.matrixClient.getCrypto()
      if (!crypto) {
        return {
          success: false,
          error: 'Crypto not available',
          step: 'crypto-check'
        }
      }

      // Check if cross-signing is ready
      const crossSigningReady = await crypto.isCrossSigningReady()
      if (!crossSigningReady) {
        logger.debug('Cross-signing not ready, attempting setup...')
        const setupResult = await this.setupMainDevice()
        return setupResult
      }

      // Verify current device is trusted
      const userId = this.matrixClient.getUserId()
      const deviceId = this.matrixClient.getDeviceId()

      if (!userId || !deviceId) {
        return {
          success: false,
          error: 'User ID or device ID not available',
          step: 'user-info'
        }
      }

      const verificationStatus = await crypto.getDeviceVerificationStatus(userId, deviceId)
      const isVerified = verificationStatus?.crossSigningVerified || false

      if (!isVerified) {
        logger.debug('Current device not verified, attempting verification...')
        // Use our device verification helper
        const verifyResult = await this.testAndFixDeviceVerification()
        if (!verifyResult.success) {
          return {
            success: false,
            error: verifyResult.error,
            step: 'device-verification'
          }
        }
      }

      logger.debug('✅ Device prepared for verifying additional devices')
      return {
        success: true,
        deviceId
      }
    } catch (error) {
      logger.error('❌ Failed to prepare for additional devices:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        step: 'preparation'
      }
    }
  }

  /**
   * Get the current device status including verification state
   */
  public async getDeviceStatus (): Promise<{
    deviceId?: string
    userId?: string
    isVerified: boolean
    crossSigningReady: boolean
    secretStorageReady: boolean
    hasKeyBackup: boolean
    deviceCount: number
  }> {
    try {
      const crypto = this.matrixClient.getCrypto()
      if (!crypto) {
        return {
          isVerified: false,
          crossSigningReady: false,
          secretStorageReady: false,
          hasKeyBackup: false,
          deviceCount: 0
        }
      }

      const userId = this.matrixClient.getUserId()
      const deviceId = this.matrixClient.getDeviceId()

      // Check verification status
      let isVerified = false
      if (userId && deviceId) {
        const verificationStatus = await crypto.getDeviceVerificationStatus(userId, deviceId)
        isVerified = verificationStatus?.crossSigningVerified || false
      }

      // Check system status
      const [crossSigningReady, secretStorageReady, keyBackupInfo] = await Promise.all([
        crypto.isCrossSigningReady().catch(() => false),
        crypto.isSecretStorageReady().catch(() => false),
        crypto.getKeyBackupInfo().catch(() => null)
      ])

      // Get device count
      const devices = await this.getAllUserDevices()

      return {
        deviceId: deviceId || undefined,
        userId: userId || undefined,
        isVerified,
        crossSigningReady,
        secretStorageReady,
        hasKeyBackup: !!keyBackupInfo,
        deviceCount: devices.length
      }
    } catch (error) {
      logger.error('Failed to get device status:', error)
      return {
        isVerified: false,
        crossSigningReady: false,
        secretStorageReady: false,
        hasKeyBackup: false,
        deviceCount: 0
      }
    }
  }

  /**
   * Complete device verification workflow for a second device
   * This includes accepting verification requests and completing the verification
   */
  public async handleSecondDeviceVerification (): Promise<DeviceSetupResult> {
    try {
      logger.debug('🔐 Handling second device verification workflow...')

      // Check for pending verification requests
      const pendingRequests = this.getPendingRequests()

      if (pendingRequests.length === 0) {
        return {
          success: false,
          error: 'No pending verification requests found. Make sure the second device has initiated verification.',
          step: 'no-requests'
        }
      }

      // Handle the most recent request
      const latestRequest = pendingRequests[pendingRequests.length - 1]
      logger.debug('🔍 Processing verification request:', latestRequest.requestId)

      // Accept the verification request
      const acceptResult = await this.acceptVerificationRequest(
        latestRequest.requestId,
        'm.sas.v1'
      )

      if (!acceptResult.success) {
        return {
          success: false,
          error: acceptResult.error,
          step: 'accept-verification'
        }
      }

      logger.debug('✅ Verification request accepted. Complete the emoji verification on both devices.')

      return {
        success: true,
        step: 'awaiting-emoji-confirmation'
      }
    } catch (error) {
      logger.error('❌ Failed to handle second device verification:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        step: 'verification-workflow'
      }
    }
  }

  /**
   * Reset everything and start fresh (use when things are broken)
   */
  public async resetAndSetupFresh (): Promise<DeviceSetupResult> {
    try {
      logger.debug('🔄 Performing complete reset and fresh setup...')

      // Force reset cross-signing keys using MatrixEncryptionService
      const { MatrixEncryptionService } = await import('./MatrixEncryptionManager')
      const encryptionService = new MatrixEncryptionService(this.matrixClient)

      // Reset and setup fresh encryption
      const resetResult = await encryptionService.setupEncryption('default-passphrase')

      if (!resetResult.success) {
        return {
          success: false,
          error: resetResult.error,
          step: 'reset'
        }
      }

      logger.debug('✅ Complete reset and fresh setup completed')
      return {
        success: true,
        recoveryKey: resetResult.recoveryKey
      }
    } catch (error) {
      logger.error('❌ Failed to reset and setup fresh:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        step: 'fresh-setup'
      }
    }
  }

  /**
   * Get easy-to-understand instructions for the user
   */
  public async getSetupInstructions (): Promise<{
    currentStep: string
    instructions: string
    nextAction?: string
    troubleshooting?: string
  }> {
    const status = await this.getDeviceStatus()

    if (!status.secretStorageReady || !status.crossSigningReady) {
      return {
        currentStep: 'initial-setup',
        instructions: 'Your encryption needs to be set up first. This will generate a recovery key that you must save securely.',
        nextAction: 'Run setupMainDevice()',
        troubleshooting: 'If setup fails, check that your Matrix server supports cross-signing and that you have the necessary permissions.'
      }
    }

    if (!status.isVerified) {
      return {
        currentStep: 'device-verification',
        instructions: 'Your device needs to be verified to enable full encryption support.',
        nextAction: 'Complete device verification process',
        troubleshooting: 'If verification fails, try the resetAndSetupFresh() method.'
      }
    }

    if (status.deviceCount > 1) {
      return {
        currentStep: 'multi-device',
        instructions: `You have ${status.deviceCount} devices. Additional devices can be verified through the verification flow.`,
        nextAction: 'Use Element or another Matrix client to verify new devices',
        troubleshooting: 'Check the device list and clean up old devices if needed.'
      }
    }

    return {
      currentStep: 'ready',
      instructions: 'Your device is properly set up and verified. You can now use encrypted messaging.',
      nextAction: 'No action needed - system ready',
      troubleshooting: 'If issues arise, check device status periodically.'
    }
  }

  // ============================================================================
  // DEVICE MANAGEMENT OPERATIONS
  // ============================================================================

  /**
   * Get all devices for the current user with OpenMeet-specific metadata
   */
  public async getUserDevices (): Promise<DeviceInfo[]> {
    try {
      const userId = this.matrixClient.getUserId()
      const currentDeviceId = this.matrixClient.getDeviceId()

      if (!userId) {
        throw new Error('No user ID available')
      }

      const crypto = this.matrixClient.getCrypto()
      if (!crypto) {
        throw new Error('Crypto not available')
      }

      // Get device info from Matrix
      const devices = await crypto.getUserDeviceInfo([userId])
      const userDevices = devices.get(userId)

      if (!userDevices) {
        return []
      }

      const deviceList: DeviceInfo[] = []

      for (const [deviceId, deviceInfo] of userDevices) {
        const isCurrentDevice = deviceId === currentDeviceId
        const isTrusted = await this.isDeviceTrusted(deviceId)
        const isOpenMeetClient = await this.detectOpenMeetClient(deviceId, deviceInfo.displayName)

        // Type assertion for Matrix SDK's incomplete device info types
        const extendedDeviceInfo = deviceInfo as unknown as ExtendedDeviceInfo

        deviceList.push({
          deviceId,
          displayName: extendedDeviceInfo.displayName || 'Unknown Device',
          isVerified: !!extendedDeviceInfo.verified,
          isCurrentDevice,
          isTrusted,
          isOpenMeetClient,
          lastSeen: extendedDeviceInfo.lastSeenTs || 0,
          verificationMethod: await this.getVerificationMethod(deviceId)
        })
      }

      // Sort: current device first, then by last seen
      return deviceList.sort((a, b) => {
        if (a.isCurrentDevice) return -1
        if (b.isCurrentDevice) return 1
        return b.lastSeen - a.lastSeen
      })
    } catch (error) {
      logger.error('Failed to get user devices:', error)
      return []
    }
  }

  /**
   * Get all devices for the current user (alias for consistency)
   */
  public async getAllUserDevices (): Promise<Array<{deviceId: string, displayName?: string, isCurrentDevice: boolean, verified: boolean}>> {
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

      const deviceList = await Promise.all(
        Array.from(userDevices.entries()).map(async ([deviceId, device]) => {
          // Check verification status for each device - require BOTH local AND cross-signing verification like Element
          let verified = false
          try {
            const verificationStatus = await crypto.getDeviceVerificationStatus(userId, deviceId)
            // Check both local verification and cross-signing verification properties
            const isLocallyVerified = verificationStatus?.localVerified || false
            const isCrossSigningVerified = verificationStatus?.crossSigningVerified || false
            // For Element compatibility, require both local verification and cross-signing verification
            verified = isLocallyVerified && isCrossSigningVerified
          } catch (error) {
            logger.debug(`Could not check verification for device ${deviceId}:`, error)
          }

          return {
            deviceId,
            displayName: device.displayName || `Device ${deviceId}`,
            isCurrentDevice: deviceId === currentDeviceId,
            verified
          }
        })
      )

      logger.warn('🔍 Found devices:', deviceList)
      return deviceList
    } catch (error) {
      logger.error('Failed to get user devices:', error)
      return []
    }
  }

  /**
   * Verify a device using the most appropriate method
   */
  public async verifyDevice (deviceId: string, method: 'auto' | 'interactive' = 'auto'): Promise<boolean> {
    try {
      const userId = this.matrixClient.getUserId()
      const crypto = this.matrixClient.getCrypto()

      if (!userId || !crypto) {
        throw new Error('Missing user ID or crypto')
      }

      if (method === 'auto') {
        // Try auto-verification for first OpenMeet device
        const isFirstDevice = await this.isFirstOpenMeetDevice()
        if (isFirstDevice) {
          await crypto.setDeviceVerified(userId, deviceId, true)
          await this.recordDeviceVerification(deviceId, 'auto-first-device')
          logger.debug('✅ Device auto-verified as first OpenMeet device')
          return true
        }
      }

      // Fall back to interactive verification
      logger.debug('🔐 Starting interactive device verification for:', deviceId)
      // TODO: Implement interactive verification UI
      return false
    } catch (error) {
      logger.error('Failed to verify device:', error)
      return false
    }
  }

  /**
   * Revoke trust for a device
   */
  public async revokeDeviceTrust (deviceId: string): Promise<boolean> {
    try {
      const userId = this.matrixClient.getUserId()
      const crypto = this.matrixClient.getCrypto()

      if (!userId || !crypto) {
        throw new Error('Missing user ID or crypto')
      }

      // Unverify the device
      await crypto.setDeviceVerified(userId, deviceId, false)

      // Remove from local trust store
      await this.removeDeviceFromTrustStore(deviceId)

      logger.debug('✅ Device trust revoked:', deviceId)
      return true
    } catch (error) {
      logger.error('Failed to revoke device trust:', error)
      return false
    }
  }

  /**
   * Check if the Matrix server supports device management API
   */
  public async checkDeviceManagementSupport (): Promise<{supported: boolean, serverDevices?: Array<{device_id: string, display_name?: string, last_seen_ip?: string, last_seen_ts?: number}>}> {
    try {
      // Try to get devices using the standard Matrix API
      const response = await this.matrixClient.getDevices()
      logger.warn('✅ Server supports device management API, found', response.devices?.length || 0, 'devices')
      return { supported: true, serverDevices: response.devices }
    } catch (error) {
      logger.warn('❌ Server does not support device management API:', error)
      return { supported: false }
    }
  }

  /**
   * Clean up stale devices with improved error handling and server support detection
   */
  public async cleanupStaleDevices (keepCount: number = 5): Promise<{success: boolean, deletedCount: number, error?: string, serverSupported?: boolean}> {
    try {
      const crypto = this.matrixClient.getCrypto()
      if (!crypto) {
        return { success: false, deletedCount: 0, error: 'Crypto not available' }
      }

      // First check if server supports device management
      const serverSupport = await this.checkDeviceManagementSupport()
      if (!serverSupport.supported) {
        logger.warn('⚠️ Matrix server does not support device management API - skipping cleanup')
        return {
          success: true,
          deletedCount: 0,
          error: 'Server does not support device management API',
          serverSupported: false
        }
      }

      const devices = await this.getAllUserDevices()
      const currentDeviceId = this.matrixClient.getDeviceId()

      logger.warn(`🔍 Device analysis: ${devices.length} total devices, current: ${currentDeviceId}`)

      // Find stale devices (not current device)
      const staleDevices = devices.filter(d => !d.isCurrentDevice && d.deviceId !== currentDeviceId)

      if (staleDevices.length <= keepCount) {
        logger.warn(`📱 Only ${staleDevices.length} stale devices, no cleanup needed (keeping ${keepCount})`)
        return { success: true, deletedCount: 0, serverSupported: true }
      }

      // Sort by device ID to have consistent cleanup order (could be enhanced to sort by last seen)
      staleDevices.sort((a, b) => a.deviceId.localeCompare(b.deviceId))

      // Only delete a few devices at a time to avoid overwhelming the server
      const maxDeletePerRun = 10
      const devicesToDelete = staleDevices.slice(0, Math.min(maxDeletePerRun, staleDevices.length - keepCount))

      logger.warn(`🧹 Attempting to clean up ${devicesToDelete.length} stale devices (keeping ${keepCount} recent + current)`)

      let deletedCount = 0
      const errors: string[] = []

      for (const device of devicesToDelete) {
        try {
          // Try without auth first, then with empty auth if required
          await this.matrixClient.deleteDevice(device.deviceId)
          deletedCount++
          logger.warn(`✅ Deleted stale device: ${device.deviceId} - ${device.displayName || 'Unknown'}`)

          // Add a small delay between deletions to be nice to the server
          await new Promise(resolve => setTimeout(resolve, 100))
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error)
          logger.warn(`⚠️ Failed to delete device ${device.deviceId}:`, errorMsg)
          errors.push(`${device.deviceId}: ${errorMsg}`)

          // If we get 401 or 403, might need user interaction - stop trying
          if (errorMsg.includes('401') || errorMsg.includes('403') || errorMsg.includes('Unauthorized')) {
            logger.warn('⚠️ Authentication required for device deletion - stopping cleanup')
            break
          }

          // If we get 404 or "Unrecognized request", the server might not support this endpoint
          if (errorMsg.includes('404') || errorMsg.includes('Unrecognized request')) {
            logger.warn('⚠️ Server does not support device deletion endpoint - stopping cleanup')
            break
          }
        }
      }

      const resultMessage = errors.length > 0
        ? `Partial cleanup: ${deletedCount}/${devicesToDelete.length} deleted. Errors: ${errors.join(', ')}`
        : `Successfully cleaned up ${deletedCount}/${devicesToDelete.length} stale devices`

      logger.warn(`✅ ${resultMessage}`)
      return {
        success: true,
        deletedCount,
        error: errors.length > 0 ? errors.join('; ') : undefined,
        serverSupported: true
      }
    } catch (error) {
      logger.error('❌ Failed to cleanup stale devices:', error)
      return { success: false, deletedCount: 0, error: String(error) }
    }
  }

  /**
   * Clean up old devices to prepare for new device verification
   */
  public async cleanupOldDevices (keepCount: number = 5): Promise<DeviceSetupResult> {
    try {
      logger.debug(`🧹 Cleaning up old devices (keeping ${keepCount})...`)

      const cleanupResult = await this.cleanupStaleDevices(keepCount)

      if (!cleanupResult.success) {
        return {
          success: false,
          error: cleanupResult.error,
          step: 'device-cleanup'
        }
      }

      logger.debug(`✅ Device cleanup completed: ${cleanupResult.deletedCount} devices removed`)
      return {
        success: true
      }
    } catch (error) {
      logger.error('❌ Failed to cleanup old devices:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        step: 'cleanup'
      }
    }
  }

  /**
   * Manually verify a device by marking it as verified in crypto store
   * This is useful when server-side verification isn't working properly
   */
  public async manuallyVerifyDevice (deviceId: string): Promise<{success: boolean, error?: string}> {
    try {
      const crypto = this.matrixClient.getCrypto()
      if (!crypto) {
        return { success: false, error: 'Crypto not available' }
      }

      const userId = this.matrixClient.getUserId()!

      logger.warn(`🔐 Manually verifying device: ${userId}/${deviceId}`)

      // Use the crypto API to mark device as verified
      await crypto.setDeviceVerified(userId, deviceId, true)

      // Verify it worked - check both local and cross-signing verification properties
      const verificationStatus = await crypto.getDeviceVerificationStatus(userId, deviceId)
      const isLocallyVerified = verificationStatus?.localVerified || false
      const isCrossSigningVerified = verificationStatus?.crossSigningVerified || false
      const isSDKVerified = verificationStatus?.isVerified() || false

      if (isLocallyVerified) {
        logger.warn(`✅ Device ${deviceId} locally verified. Cross-signing verified: ${isCrossSigningVerified}, SDK verified: ${isSDKVerified}`)
        if (!isCrossSigningVerified) {
          return {
            success: true,
            error: 'Device locally verified but not cross-signing verified. Element may still show as unverified.'
          }
        }
        return { success: true }
      } else {
        logger.warn(`❌ Device ${deviceId} verification failed - status not updated`)
        return { success: false, error: 'Device verification status not updated' }
      }
    } catch (error) {
      logger.error(`❌ Failed to manually verify device ${deviceId}:`, error)
      return { success: false, error: String(error) }
    }
  }

  // ============================================================================
  // DEVICE VERIFICATION UTILITIES
  // ============================================================================

  /**
   * Test and fix device verification using Element Web's simple patterns
   *
   * This follows Element Web's approach:
   * 1. Check if device is already verified
   * 2. If not, use simple createCrossSigning (no force reset)
   * 3. Let SDK handle UIA through our mobile-friendly callbacks
   */
  public async testAndFixDeviceVerification (): Promise<{
    success: boolean
    error?: string
    isVerified?: boolean
  }> {
    try {
      logger.debug('🔍 Testing device verification using Element Web patterns...')

      const client = this.matrixClient
      if (!client) {
        logger.error('❌ No Matrix client available')
        return { success: false, error: 'No Matrix client available' }
      }

      const crypto = client.getCrypto()
      if (!crypto) {
        logger.error('❌ No crypto API available')
        return { success: false, error: 'No crypto API available' }
      }

      // Check if verification is needed (Element Web pattern)
      const needsVerification = await this.checkIfVerificationNeeded(client)
      logger.debug('📊 Needs verification:', needsVerification)

      if (!needsVerification) {
        logger.debug('✅ Device is already verified')
        return { success: true, isVerified: true }
      }

      // Smart device verification: distinguish recovery from reset
      logger.debug('🔧 Attempting intelligent device verification...')

      try {
        // First, check if we can recover existing keys instead of resetting
        const [secretStorageReady, hasKeyBackup, hasDefaultKeyId] = await Promise.all([
          crypto.isSecretStorageReady().catch(() => false),
          crypto.getKeyBackupInfo().then(info => !!(info && info.version)).catch(() => false),
          client.secretStorage.getDefaultKeyId().then(id => !!id).catch(() => false)
        ])

        const canRecoverKeys = secretStorageReady && hasKeyBackup && hasDefaultKeyId

        if (canRecoverKeys) {
          logger.debug('🔑 Infrastructure exists - attempting key recovery instead of reset')
          // Use MatrixEncryptionManager for intelligent recovery
          const { matrixEncryptionState } = await import('./MatrixEncryptionManager')
          const recoveryResult = await matrixEncryptionState.recoverCrossSigningKeys()

          if (recoveryResult.success) {
            logger.debug('✅ Key recovery successful - device should now be verified')
            return { success: true, isVerified: true }
          } else {
            logger.debug('⚠️ Key recovery failed, falling back to bootstrap:', recoveryResult.error)
          }
        }

        // Fallback to bootstrap approach if recovery isn't possible or failed
        const recentMASAuth = sessionStorage.getItem('masAuthInProgress') ||
                             (Date.now() - parseInt(localStorage.getItem('lastCrossSigningReset') || '0')) < 60000 // 1 minute

        if (recentMASAuth) {
          logger.debug('🔄 Recent MAS auth detected, attempting simple bootstrap')
          const { createCrossSigning } = await import('./createCrossSigning')
          await createCrossSigning(client, false) // forceNew = false
        } else if (!canRecoverKeys) {
          logger.debug('🔄 No infrastructure exists - need fresh setup with MAS')
          localStorage.setItem('lastCrossSigningReset', Date.now().toString())
          const { createCrossSigning } = await import('./createCrossSigning')
          await createCrossSigning(client, true) // forceNew = true for fresh setup
        } else {
          logger.debug('🔧 Attempting simple cross-signing bootstrap after recovery failure')
          const { createCrossSigning } = await import('./createCrossSigning')
          await createCrossSigning(client, false) // forceNew = false
        }

        // Wait for Matrix SDK internal state to update
        logger.debug('⏳ Waiting for Matrix SDK verification state to update...')
        await new Promise(resolve => setTimeout(resolve, 3000))

        // Verify the device is now verified
        const isNowVerified = await this.checkIfVerificationNeeded(client)

        if (!isNowVerified) {
          logger.debug('✅ Device verification completed successfully')
          return { success: true, isVerified: true }
        } else {
          logger.debug('⚠️ Device verification completed but device may still need verification')
          return { success: true, isVerified: false }
        }
      } catch (error) {
        logger.error('❌ Device verification failed:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Device verification failed'
        }
      }
    } catch (error) {
      logger.error('❌ Device verification test failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * Check if device verification is needed (Element Web pattern)
   *
   * Element Web pattern: crossSigningReady && !crossSigningVerified
   */
  private async checkIfVerificationNeeded (client: MatrixClient): Promise<boolean> {
    try {
      const crypto = client.getCrypto()
      if (!crypto) return true // No crypto = needs verification

      const userId = client.getUserId()
      const deviceId = client.getDeviceId()
      if (!userId || !deviceId) return true

      const crossSigningReady = await crypto.isCrossSigningReady()
      const deviceStatus = await crypto.getDeviceVerificationStatus(userId, deviceId)

      // Element Web pattern: needs verification if cross-signing is ready but device isn't verified
      return crossSigningReady && !deviceStatus?.crossSigningVerified
    } catch (error) {
      logger.warn('Error checking verification status:', error)
      return true // Error = assume needs verification
    }
  }

  /**
   * Quick verification status check using Element Web patterns
   */
  public async quickVerificationCheck (): Promise<{
    isVerified: boolean
    status: string
    canFix: boolean
  }> {
    try {
      const client = this.matrixClient
      if (!client) {
        return { isVerified: false, status: 'No Matrix client', canFix: false }
      }

      const needsVerification = await this.checkIfVerificationNeeded(client)

      return {
        isVerified: !needsVerification,
        status: needsVerification ? 'Needs verification' : 'Verified',
        canFix: needsVerification
      }
    } catch (error) {
      logger.error('Quick verification check failed:', error)
      return { isVerified: false, status: 'Error', canFix: false }
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Check if device is trusted (local OpenMeet tracking)
   */
  private async isDeviceTrusted (deviceId: string): Promise<boolean> {
    try {
      const trustedDevices = JSON.parse(localStorage.getItem('openmeet_trusted_devices') || '{}')
      return !!trustedDevices[deviceId]
    } catch (error) {
      return false
    }
  }

  /**
   * Detect if device is an OpenMeet client
   */
  private async detectOpenMeetClient (deviceId: string, displayName?: string): Promise<boolean> {
    try {
      // Check display name patterns
      if (displayName) {
        const openMeetPatterns = [
          /openmeet/i,
          /om-platform/i,
          /element.*openmeet/i
        ]

        if (openMeetPatterns.some(pattern => pattern.test(displayName))) {
          return true
        }
      }

      // Check if it's the current device (we know we're OpenMeet)
      const currentDeviceId = this.matrixClient.getDeviceId()
      if (deviceId === currentDeviceId) {
        const isWebApp = window.location.hostname.includes('openmeet')
        return isWebApp
      }

      return false
    } catch (error) {
      return false
    }
  }

  /**
   * Check if this is the first OpenMeet device
   */
  private async isFirstOpenMeetDevice (): Promise<boolean> {
    try {
      const devices = await this.getUserDevices()
      const openMeetDevices = devices.filter(d => d.isOpenMeetClient && d.isVerified)

      // If no other OpenMeet devices are verified, this is the first
      return openMeetDevices.length === 0
    } catch (error) {
      return false
    }
  }

  /**
   * Record device verification in local storage
   */
  private async recordDeviceVerification (deviceId: string, method: string): Promise<void> {
    try {
      const trustedDevices = JSON.parse(localStorage.getItem('openmeet_trusted_devices') || '{}')
      trustedDevices[deviceId] = {
        trustedAt: Date.now(),
        verificationMethod: method,
        version: '1.0'
      }
      localStorage.setItem('openmeet_trusted_devices', JSON.stringify(trustedDevices))
    } catch (error) {
      logger.debug('Could not record device verification:', error)
    }
  }

  /**
   * Get verification method for device
   */
  private async getVerificationMethod (deviceId: string): Promise<string | undefined> {
    try {
      const trustedDevices = JSON.parse(localStorage.getItem('openmeet_trusted_devices') || '{}')
      return trustedDevices[deviceId]?.verificationMethod
    } catch (error) {
      return undefined
    }
  }

  /**
   * Remove device from trust store
   */
  private async removeDeviceFromTrustStore (deviceId: string): Promise<void> {
    try {
      const trustedDevices = JSON.parse(localStorage.getItem('openmeet_trusted_devices') || '{}')
      delete trustedDevices[deviceId]
      localStorage.setItem('openmeet_trusted_devices', JSON.stringify(trustedDevices))
    } catch (error) {
      logger.debug('Could not remove device from trust store:', error)
    }
  }

  // ============================================================================
  // EVENT LISTENER MANAGEMENT
  // ============================================================================

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

  // ============================================================================
  // CLEANUP
  // ============================================================================

  /**
   * Clean up resources
   */
  public destroy (): void {
    this.removeAllListeners()
    this.activeRequests.clear()
    this.activeVerifiers.clear()
  }
}

// Add to window for easy access in browser console (from deviceVerificationHelper)
if (typeof window !== 'undefined') {
  (window as Window & { deviceVerification?: Record<string, unknown> }).deviceVerification = {
    test: async () => {
      const { matrixClientManager } = await import('./MatrixClientManager')
      const client = matrixClientManager.getClient()
      if (client) {
        const manager = new MatrixDeviceManager(client)
        return await manager.testAndFixDeviceVerification()
      }
      return { success: false, error: 'No Matrix client available' }
    },
    check: async () => {
      const { matrixClientManager } = await import('./MatrixClientManager')
      const client = matrixClientManager.getClient()
      if (client) {
        const manager = new MatrixDeviceManager(client)
        return await manager.quickVerificationCheck()
      }
      return { isVerified: false, status: 'No Matrix client', canFix: false }
    }
  }

  console.log('🔧 Device verification tools available at window.deviceVerification')
}
