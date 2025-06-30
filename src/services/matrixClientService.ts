/**
 * Matrix JS SDK Client Service with MAS (Matrix Authentication Service) OIDC Authentication
 *
 * This service provides direct Matrix client functionality using the Matrix JS SDK
 * with MAS OIDC authentication flow through the OpenMeet backend, replacing direct
 * Matrix SSO authentication.
 *
 * Authentication Flow:
 * 1. User initiates Matrix connection via connectToMatrix()
 * 2. Service redirects to /api/oidc/auth with OpenMeet credentials
 * 3. Backend handles MAS OIDC flow and tenant authentication
 * 4. User returns with authorization code
 * 5. Service exchanges code for Matrix credentials via /api/oidc/token
 * 6. Matrix client is initialized with received credentials
 *
 * This approach provides secure, tenant-aware Matrix authentication while
 * maintaining compatibility with Matrix JS SDK features.
 */

import type { MatrixClient, MatrixEvent, Room, RoomMember, Preset, Visibility } from 'matrix-js-sdk'
import { RoomEvent, RoomMemberEvent, EventType, ClientEvent, createClient, IndexedDBCryptoStore, Direction } from 'matrix-js-sdk'
import { useAuthStore } from '../stores/auth-store'
import type { MatrixMessageContent } from '../types/matrix'

class MatrixClientService {
  private client: MatrixClient | null = null
  private isInitializing = false
  private initPromise: Promise<MatrixClient> | null = null

  /**
   * Initialize Matrix client with persistent authentication
   * Now requires manual initiation to avoid rate limiting
   */
  async initializeClient (forceAuth = false): Promise<MatrixClient> {
    // Return existing client if already logged in
    if (this.client && this.client.isLoggedIn()) {
      console.log('✅ Matrix client already initialized and logged in')
      return this.client
    }

    // First, try to restore from stored credentials (including access token)
    const storedSession = this._getStoredCredentials()
    if (storedSession && storedSession.hasSession && !this.client) {
      console.log('🔑 Found stored Matrix session, attempting restore')
      try {
        await this._createClientFromStoredCredentials(storedSession)
        if (this.client?.isLoggedIn()) {
          console.log('✅ Successfully restored Matrix session from stored credentials')
          return this.client
        }
      } catch (error) {
        console.warn('⚠️ Failed to restore stored session:', error)
        // Don't clear credentials immediately - might just be a temporary network issue
        // Will clear them if other auth methods also fail
      }
    }

    // Check if we're returning from MAS OIDC with authorization code
    const urlParams = new URLSearchParams(window.location.search)
    const authCode = urlParams.get('code')
    const state = urlParams.get('state')

    if (authCode) {
      // We're returning from MAS OIDC, complete the login
      console.log('🎫 Found OIDC authorization code in URL, completing Matrix login')
      return this._completeOIDCLogin(authCode, state)
    }

    // Only attempt authentication if explicitly requested (forceAuth = true)
    if (!forceAuth) {
      throw new Error('Matrix client not authenticated. Manual authentication required.')
    }

    // Skip broken silent authentication and go directly to working redirect flow
    console.log('🔄 Initiating Matrix authentication via redirect (silent auth disabled due to 0% success rate)')

    // Clear any potentially stale stored credentials since restore failed
    this._clearStoredCredentials()

    // Prevent concurrent initialization attempts
    if (this.isInitializing && this.initPromise) {
      console.log('🔄 Matrix initialization already in progress, waiting...')
      return this.initPromise
    }

    this.isInitializing = true
    this.initPromise = this._performFullPageRedirectAuth().then(() => {
      throw new Error('Redirect flow initiated - client will be created after redirect')
    })

    try {
      const client = await this.initPromise
      this.isInitializing = false
      return client
    } catch (redirectError) {
      this.isInitializing = false
      this.initPromise = null
      throw new Error('Matrix authentication failed. Please try refreshing the page.')
    }
  }

  /**
   * Perform full-page redirect using MAS (Matrix Authentication Service) OIDC flow
   */
  private async _performFullPageRedirectAuth (): Promise<void> {
    console.log('🔐 Starting MAS OIDC authentication flow for Matrix client')

    try {
      // Check if user is authenticated with OpenMeet
      const authStore = useAuthStore()
      if (!authStore.isAuthenticated) {
        throw new Error('User must be logged into OpenMeet first')
      }

      // Use MAS OIDC flow instead of direct Matrix SSO
      await this._redirectToMASLogin()

      // This function will not return normally - the page redirects to MAS/OIDC
      // The user will return via the redirect URL with loginToken
    } catch (error) {
      console.error('❌ Failed to initialize Matrix client:', error)
      throw new Error(`Matrix client initialization failed: ${error.message}`)
    }
  }

  /**
   * Complete login when returning from MAS OIDC with authorization code
   */
  private async _completeOIDCLogin (authCode: string, state?: string | null): Promise<MatrixClient> {
    console.log('🎫 Completing Matrix login from MAS OIDC with authorization code')

    try {
      // Get API URL from configuration
      const apiUrl = window.APP_CONFIG?.APP_API_URL || ''
      if (!apiUrl) {
        throw new Error('APP_API_URL is not configured. Please check your environment configuration.')
      }

      // Exchange authorization code for Matrix credentials via backend
      const matrixCredentials = await this._exchangeOIDCCodeForMatrixCredentials(authCode, state)

      // Store credentials for future sessions
      this._storeCredentials({
        homeserverUrl: matrixCredentials.homeserverUrl,
        accessToken: matrixCredentials.accessToken,
        userId: matrixCredentials.userId,
        deviceId: matrixCredentials.deviceId
      })

      // Create Matrix client with persistent storage
      await this._createClientFromCredentials({
        homeserverUrl: matrixCredentials.homeserverUrl,
        accessToken: matrixCredentials.accessToken,
        userId: matrixCredentials.userId,
        deviceId: matrixCredentials.deviceId
      })

      // Set up event listeners
      this._setupEventListeners()

      // Start the client with crypto initialization
      console.log('🔐 Starting Matrix client with encryption support...')
      await this.client.startClient({
        initialSyncLimit: 100,
        includeArchivedRooms: false,
        lazyLoadMembers: true
      })

      // Wait for client to be ready and check crypto status
      await new Promise<void>((resolve) => {
        const checkReady = () => {
          if (this.client && this.client.isInitialSyncComplete()) {
            console.log('✅ Matrix client ready and synced')

            // Log crypto status
            const crypto = this.client.getCrypto()
            if (crypto) {
              console.log('🔐 Matrix encryption is available and ready')
            } else {
              console.log('⚠️ Matrix encryption not available - some private rooms may not work')
            }

            resolve()
          } else {
            setTimeout(checkReady, 100)
          }
        }
        checkReady()
      })

      // Clean up URL by removing OIDC parameters
      const url = new URL(window.location.href)
      url.searchParams.delete('code')
      url.searchParams.delete('state')
      window.history.replaceState({}, document.title, url.toString())

      console.log('✅ Matrix client initialized successfully from MAS OIDC:', matrixCredentials.userId)
      return this.client
    } catch (error) {
      console.error('❌ Failed to complete Matrix login from MAS OIDC:', error)

      // Check if this is an invalid token error
      console.log('🔍 Error details for token detection:', {
        message: (error as Error).message,
        errcode: (error as { errcode?: string }).errcode,
        error: (error as { error?: string }).error,
        fullError: error
      })
      if (this._isInvalidTokenError(error)) {
        console.warn('🚫 Invalid authorization code detected - clearing from URL and falling back to manual auth')

        // Clear the invalid code from URL
        const url = new URL(window.location.href)
        url.searchParams.delete('code')
        url.searchParams.delete('state')
        window.history.replaceState({}, '', url.toString())

        // Clear any stored Matrix credentials
        this._clearStoredCredentials()

        // Throw specific error for invalid token
        throw new Error('Login session expired. Please use the Connect button to authenticate again.')
      }

      throw new Error(`Matrix login completion failed: ${error.message}`)
    }
  }

  /**
   * Check if an error indicates an invalid token
   */
  private _isInvalidTokenError (error: unknown): boolean {
    const errorMessage = (error as Error).message?.toLowerCase() || ''
    const errorData = (error as { data?: unknown }).data || {}
    const errorObj = error as { errcode?: string; error?: string }

    // Check for Matrix error codes that indicate invalid/expired tokens
    // Error codes can be either on the main error object or in error.data
    const errcode = errorObj.errcode || (errorData as { errcode?: string }).errcode
    if (errcode) {
      const invalidTokenCodes = [
        'M_UNKNOWN_TOKEN',
        'M_INVALID_TOKEN',
        'M_MISSING_TOKEN',
        'M_FORBIDDEN' // Can indicate invalid token in auth context
      ]
      if (invalidTokenCodes.includes(errcode)) {
        return true
      }
    }

    // Check for common invalid token error messages
    const invalidTokenMessages = [
      'invalid token',
      'unknown token',
      'token expired',
      'token not found',
      'invalid logintoken',
      'unknown logintoken',
      'invalid login token', // Matrix specific error message
      'invalid access token passed', // Matrix 401 error
      'macaroon', // Matrix macaroon token errors
      'cannot determine data format of binary-encoded macaroon' // Specific Matrix error we saw
    ]

    return invalidTokenMessages.some(msg => errorMessage.includes(msg))
  }

  /**
   * Redirect to MAS (Matrix Authentication Service) OIDC login
   */
  private async _redirectToMASLogin (): Promise<void> {
    console.log('🔄 Starting MAS OIDC authentication flow')

    // Verify user is authenticated with OpenMeet
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) {
      throw new Error('User must be logged into OpenMeet first')
    }

    // Save current location so we can return to it after authentication
    sessionStorage.setItem('matrixReturnUrl', window.location.href)

    // Get API URL from configuration
    const apiUrl = window.APP_CONFIG?.APP_API_URL || ''
    if (!apiUrl) {
      throw new Error('APP_API_URL is not configured. Please check your environment configuration.')
    }

    // The redirect URL where MAS will send user back after authentication
    const redirectUrl = `${window.location.origin}${window.location.pathname}`

    // Build MAS OIDC login URL with proper parameters
    const masLoginParams = new URLSearchParams({
      client_id: 'mas_client', // MAS client ID configured in backend
      redirect_uri: redirectUrl,
      response_type: 'code', // OIDC authorization code flow
      scope: 'openid profile email'
    })

    // Add user email as login hint to make flow seamless
    if (authStore.user?.email) {
      masLoginParams.set('login_hint', authStore.user.email)
      console.log('🔐 Adding login hint for seamless authentication:', authStore.user.email)
    }

    // Add tenant ID to help backend identify user context
    const tenantId = window.APP_CONFIG?.APP_TENANT_ID || localStorage.getItem('tenantId')
    if (tenantId) {
      masLoginParams.set('tenantId', tenantId)  // Use camelCase to match backend expectation
      console.log('🏢 Including tenant ID in MAS login:', tenantId)
    }

    // Add user token for seamless authentication
    if (authStore.token) {
      masLoginParams.set('user_token', authStore.token)
      console.log('🔑 Adding user token for seamless authentication')
    }

    // Construct the MAS OIDC authorization URL
    const masLoginUrl = `${apiUrl}/api/oidc/auth?${masLoginParams}`

    console.log('🔗 Redirecting to MAS OIDC login:', masLoginUrl)
    console.log('🔄 Redirect URL:', redirectUrl)
    console.log('👤 User context:', authStore.user?.email || 'No email found')

    // Perform full-page redirect to MAS OIDC login
    window.location.href = masLoginUrl

    // Function will not return - page redirects away
    throw new Error('Redirect initiated - this should never be reached')
  }

  // Removed _discoverSSOProvider - no longer needed with MAS OIDC flow
  // MAS handles the Matrix authentication internally

  // Note: Removed iframe/popup authentication methods in favor of full-page redirect
  // Full-page redirect is more reliable, mobile-friendly, and follows OAuth best practices

  /**
   * Exchange OIDC authorization code for Matrix credentials via backend
   */
  private async _exchangeOIDCCodeForMatrixCredentials (authCode: string, state?: string | null): Promise<{
    userId: string;
    accessToken: string;
    deviceId: string;
    homeserverUrl: string;
  }> {
    console.log('🎫 Exchanging OIDC authorization code for Matrix credentials')

    try {
      // Get API URL and auth store
      const apiUrl = window.APP_CONFIG?.APP_API_URL || ''
      const authStore = useAuthStore()
      const tenantId = window.APP_CONFIG?.APP_TENANT_ID || localStorage.getItem('tenantId')

      // Call backend to exchange OIDC code for Matrix credentials
      const response = await fetch(`${apiUrl}/api/oidc/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Bearer ${authStore.token}`,
          'X-Tenant-ID': tenantId || ''
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: authCode,
          client_id: 'mas_client',
          redirect_uri: `${window.location.origin}${window.location.pathname}`,
          ...(state && { state })
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('❌ OIDC token exchange failed:', errorData)

        // Handle rate limiting with proper retry time
        if (errorData.error === 'rate_limit_exceeded') {
          const retryAfterMs = errorData.retry_after_ms || 300000 // Default to 5 minutes
          const retryAfterSeconds = Math.ceil(retryAfterMs / 1000)
          console.warn(`⚠️ Matrix rate limited - retry in ${retryAfterSeconds} seconds (${retryAfterMs}ms)`)

          // Store rate limit info globally for UI components
          window.matrixRetryAfter = Date.now() + retryAfterMs
        }

        // Throw the full error object for rate limiting detection
        const error = new Error(`OIDC token exchange failed: ${errorData.error_description || errorData.error || 'Unknown error'}`)
        // Attach the original error data for access to error codes
        Object.assign(error, errorData)
        throw error
      }

      const tokenData = await response.json()
      console.log('✅ OIDC token exchange successful, received Matrix credentials')

      // Extract Matrix credentials from the response
      // The backend should return Matrix access token and user info
      return {
        userId: tokenData.matrix_user_id,
        accessToken: tokenData.matrix_access_token,
        deviceId: tokenData.matrix_device_id,
        homeserverUrl: tokenData.matrix_homeserver_url
      }
    } catch (error) {
      console.error('❌ Error exchanging OIDC code for Matrix credentials:', error)
      throw new Error(`Failed to exchange OIDC code: ${error.message}`)
    }
  }

  // Note: Removed unused session checking and interactive OIDC methods
  // Full-page redirect flow handles all authentication needs

  /**
   * Public method to start Matrix authentication flow
   * This will redirect the user to MAS (Matrix Authentication Service) OIDC if not already authenticated
   */
  async connectToMatrix (): Promise<MatrixClient> {
    console.log('🔗 Starting Matrix connection flow')

    // Check if user is authenticated with OpenMeet first
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) {
      throw new Error('User must be logged into OpenMeet before connecting to Matrix')
    }

    // Initialize client - this will either complete from redirect or start new flow
    return this.initializeClient()
  }

  /**
   * Set up Matrix client event listeners for comprehensive real-time sync
   */
  private _setupEventListeners (): void {
    if (!this.client) return

    // Listen for ALL timeline events (including historical messages)
    this.client.on(RoomEvent.Timeline, (event: MatrixEvent, room: Room, toStartOfTimeline: boolean) => {
      const eventType = event.getType()

      if (eventType === 'm.room.message') {
        console.log('📨 Matrix timeline event received:', {
          eventId: event.getId(),
          roomId: room.roomId,
          isHistorical: toStartOfTimeline,
          sender: event.getSender(),
          content: event.getContent()
        })
        this._handleTimelineEvent(event, room, toStartOfTimeline)
      } else if (eventType === 'm.room.redaction') {
        console.log('🗑️ Matrix redaction event received:', {
          eventId: event.getId(),
          roomId: room.roomId,
          redactsEventId: event.event.redacts,
          sender: event.getSender()
        })
        this._handleRedactionEvent(event, room)
      }
    })

    // Listen for sync state changes to detect connection issues
    this.client.on(ClientEvent.Sync, (state: string, prevState: string | null, data: unknown) => {
      console.log(`🔄 Matrix sync state: ${prevState} → ${state}`, data)

      if (state === 'PREPARED') {
        console.log('✅ Matrix client fully synced and ready')
      } else if (state === 'SYNCING') {
        console.log('🔄 Matrix client syncing...')
      } else if (state === 'ERROR') {
        console.error('❌ Matrix sync error:', data)
        // Attempt to restart sync after a delay
        setTimeout(() => {
          if (this.client && this.client.getSyncState() === 'ERROR') {
            console.log('🔄 Restarting Matrix sync after error...')
            try {
              this.client.startClient({
                initialSyncLimit: 50,
                includeArchivedRooms: false,
                lazyLoadMembers: true
              })
            } catch (error) {
              console.error('❌ Failed to restart Matrix sync:', error)
            }
          }
        }, 5000)
      } else if (state === 'RECONNECTING') {
        console.log('🔄 Matrix client reconnecting...')
      } else if (state === 'STOPPED') {
        console.warn('⚠️ Matrix sync stopped')
      }
    })

    // Listen for room timeline resets (can happen during sync issues)
    this.client.on(RoomEvent.TimelineReset, (room: Room, timelineSet: unknown, resetAllTimelines: boolean) => {
      console.log('🔄 Matrix room timeline reset:', room.roomId, { resetAllTimelines })
      // Emit event for UI to refresh messages
      const customEvent = new CustomEvent('matrix:timeline-reset', {
        detail: { roomId: room.roomId, resetAllTimelines }
      })
      window.dispatchEvent(customEvent)
    })

    // Listen for typing notifications using proper Matrix SDK event types
    this.client.on(RoomMemberEvent.Typing, (event: MatrixEvent, member: RoomMember) => {
      const isTyping = (member as unknown as { typing: boolean }).typing
      console.log('⌨️ Typing notification:', member.userId, 'typing:', isTyping)
      this._handleTypingNotification(member, isTyping)
    })

    // Listen for read receipts using proper Matrix SDK event types
    this.client.on(RoomEvent.Receipt, (event: MatrixEvent, room: Room) => {
      console.log('✅ Read receipt received in room:', room.roomId)
      // Read receipt handling not yet implemented
    })

    // Listen for room membership changes using proper Matrix SDK event types
    this.client.on(RoomMemberEvent.Membership, (event: MatrixEvent, member: RoomMember) => {
      console.log('👥 Room membership change:', member.userId, (member as unknown as { membership: string }).membership)
    })

    console.log('🎧 Matrix client event listeners configured')
  }

  /**
   * Handle timeline events from Matrix (both live and historical)
   */
  private _handleTimelineEvent (event: MatrixEvent, room: Room, toStartOfTimeline: boolean): void {
    const messageData = {
      id: event.getId(),
      roomId: room.roomId,
      sender: {
        id: event.getSender(),
        name: event.sender?.name || event.getSender() || 'Unknown',
        avatar: event.sender?.getAvatarUrl(this.client!.baseUrl, 32, 32, 'crop', false, false) || null
      },
      content: event.getContent(),
      timestamp: event.getTs(),
      type: event.getContent().msgtype === 'm.image' ? 'image' as const : 'text' as const,
      isHistorical: toStartOfTimeline
    }

    console.log(`📨 Processing ${toStartOfTimeline ? 'historical' : 'live'} message:`, messageData)

    // Note: UI components now listen directly to Matrix SDK events via room.on(RoomEvent.Timeline)
    // Custom events removed to prevent interference with direct reactivity
  }

  /**
   * Handle new message from Matrix (legacy method - now calls _handleTimelineEvent)
   *
   * Components will use Matrix SDK directly for message display:
   * - room.timeline for message history
   * - room.on('Room.timeline') for live updates
   * - Matrix SDK handles all message storage and sync
   */
  private _handleNewMessage (event: MatrixEvent, room: Room): void {
    // Delegate to the new timeline handler
    this._handleTimelineEvent(event, room, false)
    console.log('📨 New message in room', room.roomId, 'from', event.getSender())

    // Note: UI components now listen directly to Matrix SDK events
    // Custom matrix:message events removed to prevent duplicate processing
  }

  /**
   * Handle typing notification
   */
  private _handleTypingNotification (member: RoomMember, isTyping: boolean): void {
    console.log('⌨️ Typing notification:', member.userId, 'in', member.roomId, 'typing:', isTyping)

    // Get user display name
    const displayName = member.name || member.rawDisplayName || member.userId.split(':')[0].substring(1) || 'Unknown'

    // Emit custom event for typing indicators
    window.dispatchEvent(new CustomEvent('matrix:typing', {
      detail: {
        roomId: member.roomId,
        userId: member.userId,
        userName: displayName,
        typing: isTyping
      }
    }))
  }

  /**
   * Handle redaction events from Matrix
   */
  private _handleRedactionEvent (event: MatrixEvent, room: Room): void {
    const redactsEventId = event.event.redacts
    if (!redactsEventId) return

    // Emit custom event for message redaction
    window.dispatchEvent(new CustomEvent('matrix:redaction', {
      detail: {
        roomId: room.roomId,
        redactedEventId: redactsEventId,
        redactionEventId: event.getId(),
        sender: event.getSender()
      }
    }))
  }

  /**
   * Send a message to a room
   */
  async sendMessage (roomId: string, content: MatrixMessageContent): Promise<void> {
    if (!this.client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      const room = this.client.getRoom(roomId)
      const crypto = this.client.getCrypto()

      if (room && room.hasEncryptionStateEvent()) {
        console.log('🔐 Sending encrypted message to room:', roomId)

        if (!crypto) {
          throw new Error('This room requires encryption, but encryption is not available in this client. This is typically needed for private/direct message rooms.')
        }
      } else {
        console.log('📝 Sending unencrypted message to room:', roomId)
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.client.sendEvent(roomId, EventType.RoomMessage, content as any)
      console.log('📤 Message sent successfully to room:', roomId)
    } catch (error) {
      console.error('❌ Failed to send message:', error)

      // Check if this is an authentication error and clear corrupted tokens
      if (this._isInvalidTokenError(error)) {
        console.warn('🚫 Invalid access token detected during message send - clearing stored credentials')
        this._clearStoredCredentials()
        throw new Error('Your session has expired. Please click "Connect" to authenticate again.')
      }

      // Provide helpful error message for encryption issues
      const errorMessage = (error as Error).message
      if (errorMessage && errorMessage.includes('encryption')) {
        throw new Error(`Encryption error: ${errorMessage}. This room requires encryption for privacy (common for direct messages). The client encryption may need to be properly initialized.`)
      }

      throw error
    }
  }

  /**
   * Send read receipt for a message
   */
  async sendReadReceipt (roomId: string, eventId: string): Promise<void> {
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
        console.warn('Event not found for read receipt:', eventId)
        return
      }

      await this.client.sendReadReceipt(event)
      console.log('📖 Read receipt sent for event:', eventId)
    } catch (error) {
      console.error('❌ Failed to send read receipt:', error)

      // Check if this is an authentication error and clear corrupted tokens
      if (this._isInvalidTokenError(error)) {
        console.warn('🚫 Invalid access token detected during read receipt - clearing stored credentials')
        this._clearStoredCredentials()
        throw new Error('Your session has expired. Please click "Connect" to authenticate again.')
      }

      throw error
    }
  }

  /**
   * Get read receipts for a message
   */
  getReadReceipts (roomId: string, eventId: string): Array<{ userId: string, timestamp: number }> {
    if (!this.client) {
      return []
    }

    try {
      const room = this.client.getRoom(roomId)
      if (!room) {
        return []
      }

      const event = room.findEventById(eventId)
      if (!event) {
        return []
      }

      const receipts = room.getReceiptsForEvent(event)
      return receipts.map(receipt => ({
        userId: receipt.userId,
        timestamp: receipt.data?.ts || 0
      }))
    } catch (error) {
      console.warn('⚠️ Failed to get read receipts:', error)
      return []
    }
  }

  /**
   * Redact (delete) a message
   */
  async redactMessage (roomId: string, eventId: string, reason?: string): Promise<void> {
    if (!this.client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      console.log('🗑️ Redacting message:', eventId, 'in room:', roomId)
      await this.client.redactEvent(roomId, eventId, reason)
      console.log('✅ Message redacted successfully')
    } catch (error) {
      console.error('❌ Failed to redact message:', error)
      throw error
    }
  }

  /**
   * Send typing notification
   */
  async sendTyping (roomId: string, isTyping: boolean, timeout?: number): Promise<void> {
    if (!this.client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      await this.client.sendTyping(roomId, isTyping, timeout || 10000)
    } catch (error) {
      console.error('❌ Failed to send typing notification:', error)

      // Check if this is an authentication error and clear corrupted tokens
      if (this._isInvalidTokenError(error)) {
        console.warn('🚫 Invalid access token detected during typing notification - clearing stored credentials')
        this._clearStoredCredentials()
        // Don't throw error for typing notifications - they're not critical
        console.warn('⚠️ Session expired during typing notification. Please click "Connect" to authenticate again.')
        return
      }

      throw error
    }
  }

  /**
   * Upload file and send to room
   */
  async uploadAndSendFile (roomId: string, file: File): Promise<void> {
    if (!this.client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      console.log('📎 Uploading file:', file.name)
      const contentUri = await this.uploadFile(file)

      // Determine message type based on file type
      let msgtype = 'm.file'
      const content = {
        msgtype,
        body: file.name,
        filename: file.name,
        info: {
          size: file.size,
          mimetype: file.type
        },
        url: contentUri
      }

      if (file.type.startsWith('image/')) {
        msgtype = 'm.image'
        content.msgtype = msgtype
      } else if (file.type.startsWith('video/')) {
        msgtype = 'm.video'
        content.msgtype = msgtype
      } else if (file.type.startsWith('audio/')) {
        msgtype = 'm.audio'
        content.msgtype = msgtype
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.client.sendEvent(roomId, EventType.RoomMessage, content as any)
      console.log('📤 File sent to room:', roomId)
    } catch (error) {
      console.error('❌ Failed to upload and send file:', error)
      throw error
    }
  }

  /**
   * Get room typing users
   */
  getRoomTypingUsers (roomId: string): string[] {
    const room = this.getRoom(roomId)
    if (!room) return []

    const typingUsers = room.currentState.getStateEvents('m.typing', '')
    if (!typingUsers) return []

    const content = typingUsers.getContent()
    return content.user_ids || []
  }

  /**
   * Check if room is encrypted
   */
  isRoomEncrypted (roomId: string): boolean {
    const room = this.getRoom(roomId)
    if (!room) return false

    return room.hasEncryptionStateEvent()
  }

  /**
   * Get user's joined rooms
   */
  getUserRooms (): Array<{
    id: string
    name: string
    type: 'direct' | 'group' | 'event'
    matrixRoomId: string
    lastMessage?: string
    lastActivity?: Date
    unreadCount?: number
    participants?: Array<{ id: string; name: string; avatar?: string }>
    isEncrypted?: boolean
  }> {
    if (!this.client) {
      console.warn('Matrix client not available')
      return []
    }

    const rooms = this.client.getRooms()
    return rooms.map(room => {
      const roomName = room.name || room.getCanonicalAlias() || room.roomId
      const lastMessage = room.timeline?.[room.timeline.length - 1]
      const unreadCount = room.getUnreadNotificationCount()

      // Determine room type based on name or metadata
      let type: 'direct' | 'group' | 'event' = 'group'
      if (room.getJoinedMemberCount() === 2) {
        type = 'direct'
      } else if (roomName.toLowerCase().includes('event')) {
        type = 'event'
      }

      return {
        id: room.roomId,
        name: roomName,
        type,
        matrixRoomId: room.roomId,
        lastMessage: lastMessage?.getContent()?.body || '',
        lastActivity: lastMessage ? new Date(lastMessage.getTs()) : undefined,
        unreadCount: unreadCount > 0 ? unreadCount : undefined,
        participants: room.getJoinedMembers().map(member => ({
          id: member.userId,
          name: member.name || member.userId,
          avatar: member.getAvatarUrl(this.client!.getHomeserverUrl(), 32, 32, 'crop', undefined, undefined) || undefined
        })),
        isEncrypted: room.hasEncryptionStateEvent()
      }
    })
  }

  /**
   * Get user display name and avatar
   */
  getUserProfile (userId: string, roomId?: string): { displayName?: string; avatarUrl?: string } {
    if (!this.client) return {}

    if (roomId) {
      const room = this.getRoom(roomId)
      if (room) {
        const member = room.getMember(userId)
        if (member) {
          return {
            displayName: member.name,
            avatarUrl: member.getAvatarUrl(this.client.getHomeserverUrl(), 32, 32, 'crop', undefined, undefined)
          }
        }
      }
    }

    // Fallback to global user profile
    const user = this.client.getUser(userId)
    if (user) {
      return {
        displayName: user.displayName || userId,
        avatarUrl: user.avatarUrl
      }
    }

    return { displayName: userId }
  }

  /**
   * Format Matrix content URI for display
   */
  getContentUrl (mxcUrl: string, width?: number, height?: number): string {
    if (!this.client || !mxcUrl.startsWith('mxc://')) return mxcUrl

    return this.client.mxcUrlToHttp(mxcUrl, width, height) || mxcUrl
  }

  /**
   * Join a room
   */
  async joinRoom (roomId: string): Promise<Room> {
    if (!this.client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      const room = await this.client.joinRoom(roomId)
      console.log('🚪 Joined room:', roomId)
      return room
    } catch (error) {
      console.error('❌ Failed to join room:', error)

      // Check if this is an authentication error and clear corrupted tokens
      if (this._isInvalidTokenError(error)) {
        console.warn('🚫 Invalid access token detected during room join - clearing stored credentials')
        this._clearStoredCredentials()
        throw new Error('Your session has expired. Please click "Connect" to authenticate again.')
      }

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
      const upload = await this.client.uploadContent(file)
      console.log('📎 File uploaded:', upload.content_uri)
      return upload.content_uri
    } catch (error) {
      console.error('❌ Failed to upload file:', error)
      throw error
    }
  }

  /**
   * Join or create a direct message room with another user
   */
  async joinDirectMessageRoom (userIdOrHandle: string): Promise<Room> {
    if (!this.client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      // Ensure the user ID is properly formatted
      let userId = userIdOrHandle
      if (!userId.startsWith('@')) {
        // If it's a handle like 'john.doe', convert to full Matrix ID
        userId = `@${userId}:${this.client.getDomain()}`
      }

      console.log('💬 Creating/joining direct message room with:', userId)

      // Use Matrix SDK's createRoom method for direct messages (encrypted private room)
      const roomData = await this.client.createRoom({
        is_direct: true,
        invite: [userId],
        preset: 'trusted_private_chat' as Preset,
        visibility: 'private' as Visibility,
        // Direct messages should be encrypted for privacy
        initial_state: [
          {
            type: 'm.room.encryption',
            content: {
              algorithm: 'm.megolm.v1.aes-sha2'
            }
          }
        ]
      })

      const room = this.client.getRoom(roomData.room_id)
      if (!room) {
        throw new Error('Failed to get created room')
      }

      console.log('✅ Direct message room created/joined:', room.roomId)
      return room
    } catch (error) {
      console.error('❌ Failed to join/create direct message room:', error)
      throw error
    }
  }

  /**
   * Join an event chat room by event slug
   */
  async joinEventChatRoom (eventSlug: string): Promise<{ room: Room; roomInfo: unknown }> {
    if (!this.client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      console.log('🎪 Joining event chat room for event:', eventSlug)

      // First, join via the API to ensure permissions are handled
      const authStore = useAuthStore()
      const tenantId = window.APP_CONFIG?.APP_TENANT_ID || localStorage.getItem('tenantId')

      const joinResponse = await fetch(`/api/chat/event/${eventSlug}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authStore.token}`,
          'X-Tenant-ID': tenantId || ''
        }
      })

      if (!joinResponse.ok) {
        throw new Error(`Failed to join event chat: ${joinResponse.status} ${joinResponse.statusText}`)
      }

      const roomInfo = await joinResponse.json()
      const roomId = roomInfo.matrixRoomId

      if (!roomId) {
        throw new Error('No Matrix room ID provided by API')
      }

      // Join the Matrix room directly
      const room = await this.joinRoom(roomId)

      console.log('✅ Joined event chat room:', roomId)
      return { room, roomInfo }
    } catch (error) {
      console.error('❌ Failed to join event chat room:', error)
      throw error
    }
  }

  /**
   * Join a group chat room by group slug
   */
  async joinGroupChatRoom (groupSlug: string): Promise<{ room: Room; roomInfo: unknown }> {
    if (!this.client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      console.log('👥 Joining group chat room for group:', groupSlug)

      // First, join via the API to ensure permissions are handled
      const authStore = useAuthStore()
      const tenantId = window.APP_CONFIG?.APP_TENANT_ID || localStorage.getItem('tenantId')

      const joinResponse = await fetch(`/api/chat/group/${groupSlug}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authStore.token}`,
          'X-Tenant-ID': tenantId || ''
        }
      })

      if (!joinResponse.ok) {
        throw new Error(`Failed to join group chat: ${joinResponse.status} ${joinResponse.statusText}`)
      }

      const roomInfo = await joinResponse.json()
      const roomId = roomInfo.matrixRoomId

      if (!roomId) {
        throw new Error('No Matrix room ID provided by API')
      }

      // Join the Matrix room directly
      const room = await this.joinRoom(roomId)

      console.log('✅ Joined group chat room:', roomId)
      return { room, roomInfo }
    } catch (error) {
      console.error('❌ Failed to join group chat room:', error)
      throw error
    }
  }

  /**
   * Get all raw Matrix Room objects the user is a member of
   */
  getRooms (): Room[] {
    if (!this.client) {
      throw new Error('Matrix client not initialized')
    }

    return this.client.getRooms()
  }

  /**
   * Get a specific room by room ID
   */
  getRoom (roomId: string): Room | null {
    if (!this.client) {
      throw new Error('Matrix client not initialized')
    }

    return this.client.getRoom(roomId)
  }

  /**
   * Get room members
   */
  getRoomMembers (roomId: string): RoomMember[] {
    const room = this.getRoom(roomId)
    if (!room) {
      throw new Error(`Room not found: ${roomId}`)
    }

    return room.getMembers()
  }

  /**
   * Get room timeline (messages) with proper historical loading
   */
  getRoomTimeline (roomId: string, limit = 50): MatrixEvent[] {
    const room = this.getRoom(roomId)
    if (!room) {
      throw new Error(`Room not found: ${roomId}`)
    }

    // Get the unfiltered timeline set for full message access
    const timelineSet = room.getUnfilteredTimelineSet()
    const liveTimeline = timelineSet.getLiveTimeline()
    const events = liveTimeline.getEvents()

    console.log(`📜 Room ${roomId} timeline contains ${events.length} total events`)

    // Return most recent messages, filtering for message events
    const messageEvents = events
      .filter(event => event.getType() === 'm.room.message')
      .slice(-limit)

    console.log(`📋 Returning ${messageEvents.length} message events from timeline`)
    return messageEvents
  }

  /**
   * Load historical messages for a room with backward pagination
   * This method will paginate backwards multiple times to load ALL available historical messages
   */
  async loadRoomHistory (roomId: string, limit = 50): Promise<MatrixEvent[]> {
    const room = this.getRoom(roomId)
    if (!room) {
      throw new Error(`Room not found: ${roomId}`)
    }

    console.log(`🔄 Loading room history for ${roomId} with limit ${limit}`)

    try {
      // Get the unfiltered timeline set for full message history
      const timelineSet = room.getUnfilteredTimelineSet()
      const liveTimeline = timelineSet.getLiveTimeline()

      let totalPaginationCalls = 0
      const maxPaginationCalls = 10 // Prevent infinite loops

      // Keep paginating backwards until we have enough messages or no more history
      while (totalPaginationCalls < maxPaginationCalls) {
        const paginationToken = liveTimeline.getPaginationToken(Direction.Backward)

        if (!paginationToken) {
          console.log('ℹ️ No more historical messages to load (no pagination token)')
          break
        }

        const eventsBefore = liveTimeline.getEvents().length
        console.log(`📖 Paginating backwards (attempt ${totalPaginationCalls + 1}) - current events: ${eventsBefore}`)

        // Paginate backwards to load historical messages
        await this.client!.paginateEventTimeline(liveTimeline, {
          backwards: true,
          limit: Math.min(50, limit) // Paginate in chunks of 50 or less
        })

        const eventsAfter = liveTimeline.getEvents().length
        const newEvents = eventsAfter - eventsBefore

        console.log(`📖 Pagination ${totalPaginationCalls + 1} completed: added ${newEvents} events (total: ${eventsAfter})`)

        totalPaginationCalls++

        // If no new events were loaded, we've reached the beginning
        if (newEvents === 0) {
          console.log('ℹ️ No new events loaded - reached beginning of room history')
          break
        }

        // Count message events only
        const messageEvents = liveTimeline.getEvents()
          .filter(event => event.getType() === 'm.room.message')

        // If we have enough message events, we can stop
        if (messageEvents.length >= limit) {
          console.log(`✅ Loaded sufficient messages (${messageEvents.length} >= ${limit})`)
          break
        }
      }

      // Return all message events from the timeline, respecting the limit
      const events = liveTimeline.getEvents()
        .filter(event => event.getType() === 'm.room.message')
        .slice(-limit) // Get the most recent messages up to the limit

      console.log(`📨 Loaded ${events.length} historical messages after ${totalPaginationCalls} pagination calls`)
      return events
    } catch (error) {
      console.error('❌ Error loading room history:', error)
      // Fallback to current timeline if pagination fails
      return this.getRoomTimeline(roomId, limit)
    }
  }

  /**
   * Load ALL available historical messages for a room without any limit
   * This method will continue paginating until all historical messages are loaded
   * Use with caution as it could load thousands of messages for large rooms
   */
  async loadAllRoomHistory (roomId: string): Promise<MatrixEvent[]> {
    const room = this.getRoom(roomId)
    if (!room) {
      throw new Error(`Room not found: ${roomId}`)
    }

    console.log(`🔄 Loading ALL room history for ${roomId}`)

    try {
      // Get the unfiltered timeline set for full message history
      const timelineSet = room.getUnfilteredTimelineSet()
      const liveTimeline = timelineSet.getLiveTimeline()

      let totalPaginationCalls = 0
      const maxPaginationCalls = 50 // Higher limit for loading all messages

      // Keep paginating backwards until no more history is available
      while (totalPaginationCalls < maxPaginationCalls) {
        const paginationToken = liveTimeline.getPaginationToken(Direction.Backward)

        if (!paginationToken) {
          console.log('ℹ️ No more historical messages to load (no pagination token)')
          break
        }

        const eventsBefore = liveTimeline.getEvents().length
        console.log(`📖 Loading all history - paginating backwards (attempt ${totalPaginationCalls + 1}) - current events: ${eventsBefore}`)

        // Paginate backwards to load historical messages
        await this.client!.paginateEventTimeline(liveTimeline, {
          backwards: true,
          limit: 100 // Load in larger chunks for efficiency
        })

        const eventsAfter = liveTimeline.getEvents().length
        const newEvents = eventsAfter - eventsBefore

        console.log(`📖 Pagination ${totalPaginationCalls + 1} completed: added ${newEvents} events (total: ${eventsAfter})`)

        totalPaginationCalls++

        // If no new events were loaded, we've reached the beginning
        if (newEvents === 0) {
          console.log('ℹ️ No new events loaded - reached beginning of room history')
          break
        }
      }

      // Return ALL message events from the timeline
      const events = liveTimeline.getEvents()
        .filter(event => event.getType() === 'm.room.message')

      console.log(`📨 Loaded ALL ${events.length} historical messages after ${totalPaginationCalls} pagination calls`)
      return events
    } catch (error) {
      console.error('❌ Error loading all room history:', error)
      // Fallback to limited history if loading all fails
      return this.loadRoomHistory(roomId, 100)
    }
  }

  /**
   * Search for users by display name or Matrix ID
   */
  async searchUsers (searchTerm: string): Promise<Array<{ user_id: string; display_name?: string; avatar_url?: string }>> {
    if (!this.client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      const result = await this.client.searchUserDirectory({
        term: searchTerm,
        limit: 20
      })

      return result.results || []
    } catch (error) {
      console.error('❌ Failed to search users:', error)
      throw error
    }
  }

  /**
   * Get current Matrix client
   */
  getClient (): MatrixClient | null {
    return this.client
  }

  /**
   * Check if client is ready
   */
  isReady (): boolean {
    return this.client !== null && this.client.isLoggedIn()
  }

  /**
   * Manually connect to Matrix (for user-initiated connection)
   */
  async connect (): Promise<MatrixClient> {
    console.log('🔌 Manual Matrix connection initiated')
    return this.initializeClient(true)
  }

  /**
   * Stop and cleanup Matrix client
   */
  async cleanup (): Promise<void> {
    if (this.client) {
      console.log('🧹 Cleaning up Matrix client')
      this.client.stopClient()
      this.client = null
    }
    this.isInitializing = false
    this.initPromise = null
  }

  // Removed _generateMatrixAuthCode - no longer needed with MAS OIDC flow
  // MAS handles authentication internally without requiring auth codes

  /**
   * Store Matrix session data securely with user-specific keys
   */
  private _storeCredentials (credentials: {
    homeserverUrl: string
    accessToken: string
    userId: string
    deviceId: string
  }): void {
    try {
      // Get current OpenMeet user ID for user-specific storage keys
      const authStore = useAuthStore()
      const openMeetUserId = authStore.getUserId

      if (!openMeetUserId) {
        console.warn('⚠️ No OpenMeet user ID available, using Matrix user ID for storage key')
      }

      // Create user-specific storage keys to prevent session sharing between users
      const storageUserId = openMeetUserId || credentials.userId
      const accessTokenKey = `matrix_access_token_${storageUserId}`
      const sessionKey = `matrix_session_${storageUserId}`

      // Use sessionStorage for access token (cleared on tab close) for better security
      // Use localStorage for basic session info (persists across tabs/sessions)
      sessionStorage.setItem(accessTokenKey, credentials.accessToken)

      const basicSessionData = {
        homeserverUrl: credentials.homeserverUrl,
        userId: credentials.userId,
        deviceId: credentials.deviceId,
        timestamp: Date.now(),
        hasSession: true,
        openMeetUserId: storageUserId // Store for validation
      }
      localStorage.setItem(sessionKey, JSON.stringify(basicSessionData))

      console.log(`💾 Stored Matrix session info for user ${storageUserId} with user-specific keys`)
    } catch (error) {
      console.warn('⚠️ Failed to store Matrix session info:', error)
    }
  }

  /**
   * Get stored Matrix session info with access token using user-specific keys
   */
  private _getStoredCredentials (): {
    homeserverUrl: string
    userId: string
    deviceId: string
    accessToken?: string
    timestamp: number
    hasSession: boolean
  } | null {
    try {
      // Get current OpenMeet user ID for user-specific storage keys
      const authStore = useAuthStore()
      const openMeetUserId = authStore.getUserId

      if (!openMeetUserId) {
        console.log('🔍 No OpenMeet user ID available, checking for legacy session')
        // Fallback to legacy key for backward compatibility
        const legacyStored = localStorage.getItem('matrix_session')
        if (legacyStored) {
          console.log('📦 Found legacy Matrix session, will migrate to user-specific storage')
          const legacyData = JSON.parse(legacyStored)
          // Clear legacy session to prevent future conflicts
          localStorage.removeItem('matrix_session')
          sessionStorage.removeItem('matrix_access_token')
          return legacyData
        }
        return null
      }

      // Create user-specific storage keys
      const accessTokenKey = `matrix_access_token_${openMeetUserId}`
      const sessionKey = `matrix_session_${openMeetUserId}`

      const stored = localStorage.getItem(sessionKey)
      if (!stored) {
        console.log(`🔍 No Matrix session found for user ${openMeetUserId}`)
        return null
      }

      const sessionData = JSON.parse(stored)

      // Validate that this session belongs to the current user
      if (sessionData.openMeetUserId && sessionData.openMeetUserId !== openMeetUserId) {
        console.warn(`🚨 Session user mismatch: stored=${sessionData.openMeetUserId}, current=${openMeetUserId}`)
        this._clearStoredCredentials()
        return null
      }

      // Check if session is too old (older than 7 days for localStorage, 1 day for access token)
      const maxAge = 7 * 24 * 60 * 60 * 1000 // 7 days
      const accessTokenMaxAge = 24 * 60 * 60 * 1000 // 1 day for access token

      if (Date.now() - sessionData.timestamp > maxAge) {
        console.log('🗑️ Matrix session expired, removing')
        this._clearStoredCredentials()
        return null
      }

      // Try to get access token from sessionStorage (more recent and secure)
      const accessToken = sessionStorage.getItem(accessTokenKey)

      // If access token is available and not too old, include it
      if (accessToken && (Date.now() - sessionData.timestamp) < accessTokenMaxAge) {
        sessionData.accessToken = accessToken
        console.log('🔑 Found stored access token for immediate restoration')
      } else {
        console.log('🔑 No valid access token found, will attempt silent auth')
      }

      return sessionData
    } catch (error) {
      console.warn('⚠️ Failed to parse stored Matrix session:', error)
      this._clearStoredCredentials()
      return null
    }
  }

  /**
   * Clear stored Matrix session info and cleanup client using user-specific keys
   */
  private _clearStoredCredentials (): void {
    try {
      // Get current OpenMeet user ID for user-specific storage keys
      const authStore = useAuthStore()
      const openMeetUserId = authStore.getUserId

      if (openMeetUserId) {
        // Clear user-specific storage
        const accessTokenKey = `matrix_access_token_${openMeetUserId}`
        const sessionKey = `matrix_session_${openMeetUserId}`
        localStorage.removeItem(sessionKey)
        sessionStorage.removeItem(accessTokenKey)
        console.log(`🗑️ Cleared Matrix session info for user ${openMeetUserId}`)
      } else {
        console.log('🗑️ No user ID available, clearing legacy session keys')
      }

      // Also clear legacy keys for cleanup
      localStorage.removeItem('matrix_session')
      sessionStorage.removeItem('matrix_access_token')
    } catch (error) {
      console.warn('⚠️ Failed to clear stored session:', error)
    }
  }

  /**
   * Clear Matrix session when OpenMeet user logs out
   * This ensures Matrix sessions are tied to OpenMeet sessions and tenant boundaries are respected
   */
  async clearSession (): Promise<void> {
    console.log('🔄 Clearing Matrix session due to OpenMeet logout')

    try {
      const storedSession = this._getStoredCredentials()

      // Stop Matrix client if running
      if (this.client) {
        console.log('🛑 Stopping Matrix client and leaving rooms')

        // Leave all rooms before stopping client to clean up server-side state
        try {
          const rooms = this.client.getRooms()
          console.log(`🚪 Leaving ${rooms.length} Matrix rooms for proper cleanup`)

          // Leave rooms in parallel but don't wait too long
          const leavePromises = rooms.map(room =>
            this.client!.leave(room.roomId).catch(err =>
              console.warn(`⚠️ Failed to leave room ${room.roomId}:`, err)
            )
          )

          // Wait max 5 seconds for room cleanup
          await Promise.race([
            Promise.all(leavePromises),
            new Promise(resolve => setTimeout(resolve, 5000))
          ])
        } catch (error) {
          console.warn('⚠️ Failed to leave some rooms during cleanup:', error)
        }

        this.client.stopClient()
        this.client = null
      }

      // Clear localStorage and sessionStorage session info (contains tenant-specific session data)
      this._clearStoredCredentials()

      // Clear IndexedDB crypto store data (tenant-specific encryption data)
      if (storedSession) {
        try {
          const cryptoStoreName = `matrix-crypto-${storedSession.userId}`
          console.log(`🗑️ Clearing tenant-specific Matrix crypto store: ${cryptoStoreName}`)

          const deleteReq = indexedDB.deleteDatabase(cryptoStoreName)
          deleteReq.onsuccess = () => console.log('✅ Cleared Matrix IndexedDB crypto store')
          deleteReq.onerror = (e) => console.warn('⚠️ Failed to clear IndexedDB:', e)
        } catch (error) {
          console.warn('⚠️ Failed to clear IndexedDB crypto store:', error)
        }
      }

      // Clear any Matrix SDK internal storage that might contain tenant data
      try {
        // Clear matrix-js-sdk localStorage keys that might contain tenant-specific data
        const keysToRemove = []
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key && (key.startsWith('mx_') || key.startsWith('matrix_'))) {
            keysToRemove.push(key)
          }
        }

        keysToRemove.forEach(key => {
          localStorage.removeItem(key)
          console.log(`🗑️ Cleared Matrix SDK storage key: ${key}`)
        })

        // Also clear sessionStorage keys
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i)
          if (key && (key.startsWith('mx_') || key.startsWith('matrix_'))) {
            sessionStorage.removeItem(key)
            console.log(`🗑️ Cleared Matrix SDK sessionStorage key: ${key}`)
          }
        }
      } catch (error) {
        console.warn('⚠️ Failed to clear Matrix SDK storage:', error)
      }

      // Reset initialization state
      this.isInitializing = false
      this.initPromise = null

      console.log('✅ Matrix session and tenant-specific data cleared successfully')
    } catch (error) {
      console.error('❌ Failed to clear Matrix session:', error)
    }
  }

  /**
   * Create Matrix client from credentials with persistent storage
   */
  private async _createClientFromCredentials (credentials: {
    homeserverUrl: string
    accessToken: string
    userId: string
    deviceId: string
  }): Promise<void> {
    try {
      // Create persistent crypto store
      const cryptoStore = new IndexedDBCryptoStore(
        window.indexedDB,
        `matrix-crypto-${credentials.userId}`
      )

      this.client = createClient({
        baseUrl: credentials.homeserverUrl,
        accessToken: credentials.accessToken,
        userId: credentials.userId,
        deviceId: credentials.deviceId,
        timelineSupport: true,
        cryptoStore,
        pickleKey: credentials.userId
      })

      // Verify the client works
      await this.client.whoami()
      console.log('✅ Matrix client created successfully')
    } catch (error) {
      console.error('❌ Failed to create Matrix client from credentials:', error)

      // Check if this is an authentication error and clear corrupted tokens
      if (this._isInvalidTokenError(error)) {
        console.warn('🚫 Invalid access token detected during client creation - clearing stored credentials')
        this._clearStoredCredentials()
      }

      throw error
    }
  }

  /**
   * Try to restore Matrix client from stored credentials
   */
  private async _createClientFromStoredCredentials (sessionInfo: {
    homeserverUrl: string
    userId: string
    deviceId: string
    accessToken?: string
  }): Promise<void> {
    try {
      console.log('🔄 Attempting to restore Matrix client from stored credentials')

      // Create crypto store for encryption support
      const cryptoStore = new IndexedDBCryptoStore(
        window.indexedDB,
        `matrix-crypto-${sessionInfo.userId}`
      )

      // If we have an access token, use it directly for immediate restoration
      if (sessionInfo.accessToken) {
        console.log('🔑 Using stored access token for immediate client restoration')

        this.client = createClient({
          baseUrl: sessionInfo.homeserverUrl,
          accessToken: sessionInfo.accessToken,
          userId: sessionInfo.userId,
          deviceId: sessionInfo.deviceId,
          timelineSupport: true,
          cryptoStore,
          pickleKey: sessionInfo.userId
        })

        // Verify the client works with the stored token
        await this.client.whoami()
        console.log('✅ Matrix client restored successfully with access token')

        // Set up event listeners
        this._setupEventListeners()

        // Start the client
        await this.client.startClient({
          initialSyncLimit: 50,
          includeArchivedRooms: false,
          lazyLoadMembers: true
        })
      } else {
        // Fallback: try to restore from Matrix SDK's own persistence
        console.log('🔄 No access token available, trying Matrix SDK restoration')

        this.client = createClient({
          baseUrl: sessionInfo.homeserverUrl,
          userId: sessionInfo.userId,
          deviceId: sessionInfo.deviceId,
          timelineSupport: true,
          cryptoStore,
          pickleKey: sessionInfo.userId
        })

        // Check if Matrix SDK can restore the session
        if (this.client.isLoggedIn()) {
          await this.client.whoami()
          console.log('✅ Matrix client restored from SDK persistence')
        } else {
          throw new Error('No valid session found - will need to re-authenticate')
        }
      }
    } catch (error) {
      console.warn('⚠️ Failed to restore Matrix client from storage:', error)

      // Check if this is an authentication error and clear corrupted tokens
      if (this._isInvalidTokenError(error)) {
        console.warn('🚫 Invalid access token detected during restoration - clearing stored credentials')
        this._clearStoredCredentials()
      }

      throw error
    }
  }

  // Removed _attemptSilentAuth - replaced with MAS OIDC flow
  // Silent authentication now handled by MAS with user tokens

  // Removed _performSilentOIDCAuth - iframe auth not needed with MAS
  // MAS provides seamless authentication via server-side token validation

  // Removed _buildOIDCUrl - direct Matrix URLs not used with MAS
  // MAS handles Matrix authentication through backend OIDC endpoints
}

// Export singleton instance
export const matrixClientService = new MatrixClientService()
export default matrixClientService
