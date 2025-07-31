/**
 * Matrix JS SDK Client Service with MAS (Matrix Authentication Service) OIDC Authentication
 *
 * This service provides direct Matrix client functionality using the Matrix JS SDK
 * with MAS OIDC authentication flow through the OpenMeet backend.
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
import { RoomEvent, RoomMemberEvent, EventType, ClientEvent, IndexedDBStore, Direction, User, completeAuthorizationCodeGrant, generateOidcAuthorizationUrl, discoverAndValidateOIDCIssuerWellKnown } from 'matrix-js-sdk'
import type { IdTokenClaims } from 'oidc-client-ts'
import { persistOidcAuthenticatedSettings, getStoredOidcTokenIssuer, getStoredOidcClientId, getStoredOidcIdTokenClaims, clearStoredOidcSettings } from '../utils/oidc/persistOidcSettings'
import { useAuthStore } from '../stores/auth-store'
import type { MatrixMessageContent } from '../types/matrix'
import { matrixClientManager } from './MatrixClientManager'
import getEnv from '../utils/env'

class MatrixClientService {
  private client: MatrixClient | null = null
  private isInitializing = false
  private initPromise: Promise<MatrixClient> | null = null
  private _lastRestartAttempt: number = 0

  /**
   * Get the current Matrix client instance from MatrixClientManager
   */
  getClient (): MatrixClient | null {
    // Always return the client from MatrixClientManager if available
    const managerClient = matrixClientManager.getClient()
    if (managerClient) {
      this.client = managerClient
    }
    return this.client
  }

  /**
   * Check if Matrix client is ready for operations
   */
  isReady (): boolean {
    return matrixClientManager.isReady() || (this.client?.isLoggedIn() ?? false)
  }

  /**
   * Check if user has explicitly chosen to connect to Matrix (persists across sessions)
   * Uses localStorage with tenant/user-specific keys following matrix-js-sdk patterns
   */
  hasUserChosenToConnect (): boolean {
    const authStore = useAuthStore()
    if (!authStore.user?.slug) {
      return false
    }

    const tenantId = (getEnv('APP_TENANT_ID') as string) || localStorage.getItem('tenantId')
    if (!tenantId) {
      return false
    }

    // Use same pattern as Matrix session storage: user-specific and tenant-aware
    const choiceKey = `matrix_user_choice_${authStore.user.slug}_${tenantId}`
    return localStorage.getItem(choiceKey) === 'true'
  }

  /**
   * Set flag indicating user has chosen to connect to Matrix (persists across sessions)
   * Uses localStorage with tenant/user-specific keys following matrix-js-sdk patterns
   */
  setUserChosenToConnect (consent: boolean = true): void {
    const authStore = useAuthStore()
    if (!authStore.user?.slug) {
      console.warn('Cannot set Matrix user choice: no authenticated user')
      return
    }

    const tenantId = (getEnv('APP_TENANT_ID') as string) || localStorage.getItem('tenantId')
    if (!tenantId) {
      console.warn('Cannot set Matrix user choice: no tenant ID available')
      return
    }

    // Use same pattern as Matrix session storage: user-specific and tenant-aware
    const choiceKey = `matrix_user_choice_${authStore.user.slug}_${tenantId}`
    if (consent) {
      localStorage.setItem(choiceKey, 'true')
    } else {
      localStorage.removeItem(choiceKey)
    }
  }

  /**
   * Initialize Matrix client with persistent authentication using MatrixClientManager
   * Now requires manual initiation to avoid rate limiting
   */
  async initializeClient (forceAuth = false): Promise<MatrixClient> {
    // Check if MatrixClientManager already has a ready client
    if (matrixClientManager.isReady()) {
      this.client = matrixClientManager.getClient()
      return this.client!
    }

    // Prevent concurrent initialization attempts
    if (this.isInitializing && this.initPromise) {
      console.log('🔄 Matrix initialization already in progress, waiting...')
      return this.initPromise
    }

    // Only attempt authentication if explicitly requested (forceAuth = true) and user has consented
    if (!forceAuth) {
      throw new Error('Matrix client not authenticated. Manual authentication required.')
    }

    // Auto-consent for Matrix connection since we control both services
    this.setUserChosenToConnect(true)

    // Now try to restore from stored credentials (after consent check)
    const storedSession = this._getStoredCredentials()
    if (storedSession && storedSession.hasSession && !this.client) {
      console.log('🔑 Found stored Matrix session, attempting restore')
      try {
        const restoredClient = await this._createClientFromStoredCredentials(storedSession)
        if (restoredClient && restoredClient.isLoggedIn()) {
          console.log('✅ Successfully restored Matrix session from stored credentials')
          return restoredClient
        } else if (restoredClient === null) {
          console.log('🔑 Stored credentials were invalid, user needs to re-authenticate')
          // Credentials were cleared in _createClientFromStoredCredentials, continue to fresh auth
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
      // Immediately clear the code from URL to prevent reuse
      console.log('🎫 Found OAuth2 authorization code in URL, clearing and completing Matrix login')
      const url = new URL(window.location.href)
      url.searchParams.delete('code')
      url.searchParams.delete('state')
      window.history.replaceState({}, document.title, url.toString())

      // Set initialization tracking
      this.isInitializing = true
      this.initPromise = this.completeOAuthLogin(authCode, state)

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

    // Skip broken silent authentication and go directly to working redirect flow
    console.log('🔄 Initiating Matrix authentication via redirect (silent auth disabled due to 0% success rate)')

    // Clear any potentially stale stored credentials since restore failed
    this._clearStoredCredentials()

    // Prevent concurrent initialization attempts
    if (this.isInitializing && this.initPromise) {
      console.log('🔄 Matrix initialization already in progress, waiting...')
      return this.initPromise
    }

    // Start redirect authentication flow - this will redirect away from the page
    this.isInitializing = true

    // Call redirect method and let it handle the redirect
    await this._performFullPageRedirectAuth()

    // This code should never execute since we redirect away
    this.isInitializing = false
    throw new Error('Unexpected: redirect did not occur')
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

      // Use MAS OIDC flow for authentication
      await this._redirectToMASLogin()

      // This function will not return normally - the page redirects to MAS/OIDC
      // The user will return via the redirect URL with loginToken
    } catch (error) {
      console.error('❌ Failed to initialize Matrix client:', error)
      throw new Error(`Matrix client initialization failed: ${error.message}`)
    }
  }

  /**
   * Complete login when returning from MAS OAuth2 with authorization code
   * Uses Matrix JS SDK's OIDC methods for proper MSC3861 authentication
   */
  async completeOAuthLogin (authCode: string, state?: string | null): Promise<MatrixClient> {
    console.log('🎫 Completing Matrix login from MAS OIDC with authorization code using MSC3861')

    try {
      // State validation is now handled by the native matrix-js-sdk completeAuthorizationCodeGrant
      console.log('🔧 State validation will be handled by native SDK')

      // Use Matrix JS SDK's native OIDC completion method for MSC3861
      console.log('🔧 Using Matrix JS SDK native OIDC completion for MSC3861')

      // Use native matrix-js-sdk OIDC completion instead of custom implementation
      const oidcResult = await completeAuthorizationCodeGrant(authCode, state || '')

      console.log('✅ Matrix JS SDK OIDC completion successful:', {
        homeserverUrl: oidcResult.homeserverUrl,
        clientId: oidcResult.oidcClientSettings.clientId,
        issuer: oidcResult.oidcClientSettings.issuer,
        hasAccessToken: !!oidcResult.tokenResponse.access_token,
        hasRefreshToken: !!oidcResult.tokenResponse.refresh_token,
        tokenType: oidcResult.tokenResponse.token_type,
        scope: oidcResult.tokenResponse.scope
      })

      console.log('🔍 Full OIDC result for debugging:', oidcResult)

      // Following Element-web pattern: Use the access token to get the real user ID from homeserver
      // This avoids user ID format mismatches between ID token claims and Matrix server expectations
      console.log('🔍 Getting user ID from Matrix homeserver using access token...')
      const { createClient } = await import('matrix-js-sdk')

      // Create a temporary client to call whoami
      const tempClient = createClient({
        baseUrl: oidcResult.homeserverUrl,
        accessToken: oidcResult.tokenResponse.access_token,
        useAuthorizationHeader: true
      })

      const whoamiResponse = await tempClient.whoami()
      const actualUserId = whoamiResponse.user_id
      const actualDeviceId = whoamiResponse.device_id

      console.log('✅ Got actual user ID from homeserver:', {
        userId: actualUserId,
        deviceId: actualDeviceId
      })

      // Stop the temporary client
      tempClient.stopClient()

      const matrixCredentials = {
        userId: actualUserId, // Use the homeserver-provided user ID
        accessToken: oidcResult.tokenResponse.access_token,
        deviceId: actualDeviceId || this._generateDeviceId(), // Use homeserver device ID if available
        homeserverUrl: oidcResult.homeserverUrl,
        refreshToken: oidcResult.tokenResponse.refresh_token,
        // Include OIDC configuration for TokenRefresher
        oidcIssuer: oidcResult.oidcClientSettings.issuer,
        oidcClientId: oidcResult.oidcClientSettings.clientId,
        oidcRedirectUri: `${window.location.origin}/auth/matrix`,
        idTokenClaims: oidcResult.tokenResponse.id_token ? this._parseJWTClaims(oidcResult.tokenResponse.id_token) : undefined
      }

      console.log('🔍 Final Matrix credentials being used:', {
        userId: matrixCredentials.userId,
        homeserverUrl: matrixCredentials.homeserverUrl,
        hasAccessToken: !!matrixCredentials.accessToken,
        hasRefreshToken: !!matrixCredentials.refreshToken,
        deviceId: matrixCredentials.deviceId
      })

      // Store credentials for session persistence (Element Web approach)
      this._storeCredentials({
        homeserverUrl: matrixCredentials.homeserverUrl,
        accessToken: matrixCredentials.accessToken,
        userId: matrixCredentials.userId,
        deviceId: matrixCredentials.deviceId,
        refreshToken: matrixCredentials.refreshToken
      })

      // Persist OIDC settings using Element Web's pattern - AFTER storing credentials
      if (oidcResult.tokenResponse.id_token) {
        console.log('🔧 Persisting OIDC settings with Element Web approach:', {
          clientId: oidcResult.oidcClientSettings.clientId,
          issuer: oidcResult.oidcClientSettings.issuer,
          hasIdToken: !!oidcResult.tokenResponse.id_token
        })

        persistOidcAuthenticatedSettings(
          oidcResult.oidcClientSettings.clientId,
          oidcResult.oidcClientSettings.issuer,
          oidcResult.tokenResponse.id_token
        )

        // Verify Element Web storage worked
        const storedIssuer = getStoredOidcTokenIssuer()
        const storedClientId = getStoredOidcClientId()
        const storedClaims = getStoredOidcIdTokenClaims()

        console.log('✅ Verified Element Web OIDC persistence:', {
          storedIssuer,
          storedClientId,
          hasStoredClaims: !!storedClaims,
          persistenceWorking: !!(storedIssuer && storedClientId)
        })
      } else {
        console.warn('⚠️ No ID token available - OIDC persistence may not work for token refresh')
      }

      // Use MatrixClientManager for optimized client creation and startup
      console.log('🔐 Creating Matrix client via MatrixClientManager...')

      // Get OIDC configuration from Element Web storage for TokenRefresher
      const oidcIssuer = getStoredOidcTokenIssuer()
      const oidcClientId = getStoredOidcClientId()
      const idTokenClaims = getStoredOidcIdTokenClaims()

      console.log('🔍 Fresh auth credentials with Element Web OIDC config:', {
        hasRefreshToken: !!matrixCredentials.refreshToken,
        hasOidcIssuer: !!oidcIssuer,
        hasOidcClientId: !!oidcClientId,
        oidcIssuer,
        oidcClientId,
        usingElementWebStorage: true
      })

      this.client = await matrixClientManager.initializeClient({
        homeserverUrl: matrixCredentials.homeserverUrl,
        accessToken: matrixCredentials.accessToken,
        userId: matrixCredentials.userId,
        deviceId: matrixCredentials.deviceId,
        refreshToken: matrixCredentials.refreshToken,
        // Include Element Web OIDC configuration for TokenRefresher creation
        oidcIssuer,
        oidcClientId,
        oidcRedirectUri: `${window.location.origin}/auth/matrix`,
        idTokenClaims
      })

      // OPTIMIZATION: Set up event listeners in parallel with client startup
      console.log('🔐 Starting Matrix client with optimized configuration...')
      await Promise.all([
        // Start the client
        matrixClientManager.startClient(),
        // Set up event listeners in parallel (doesn't require client to be started)
        (async () => {
          matrixClientManager.setupEventListeners()
          this._setupEventListeners()
          console.log('🎧 Event listeners configured')
        })()
      ])

      // OPTIMIZATION: Parallel execution of client readiness check and backend sync
      await Promise.all([
        // Wait for client to be ready and check crypto status
        new Promise<void>((resolve) => {
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
        }),

        // Sync Matrix user identity with backend in parallel (non-critical)
        (async () => {
          await this._syncMatrixUserIdentityWithBackend(matrixCredentials.userId)
          console.log('🔄 Backend user identity sync completed')
        })()
      ])

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
    // Following Element Web pattern: be conservative about clearing credentials
    // Error codes can be either on the main error object or in error.data
    const errcode = errorObj.errcode || (errorData as { errcode?: string }).errcode
    if (errcode) {
      const invalidTokenCodes = [
        'M_UNKNOWN_TOKEN', // Definitely invalid token
        'M_INVALID_TOKEN', // Definitely invalid token
        'M_MISSING_TOKEN' // Definitely missing token
        // NOTE: M_FORBIDDEN removed - can be room access denial, not auth failure
        // Following Element Web pattern of conservative credential clearing
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
   * Redirect to MAS (Matrix Authentication Service) OAuth2 login
   * Uses dynamic client registration like Element-web for better security
   */
  private async _redirectToMASLogin (): Promise<void> {
    console.log('🔄 Starting native Matrix SDK OIDC authentication flow with MAS')

    // Verify user is authenticated with OpenMeet
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) {
      throw new Error('User must be logged into OpenMeet first')
    }

    // Save current location so we can return to it after authentication
    sessionStorage.setItem('matrixReturnUrl', window.location.href)

    // Get configuration from environment
    const masUrl = getEnv('APP_MAS_URL') as string
    const homeserverUrl = getEnv('APP_MATRIX_HOMESERVER_URL') as string || 'http://localhost:8448'
    const masRedirectPath = getEnv('APP_MAS_REDIRECT_PATH') as string

    if (!masUrl) {
      throw new Error('APP_MAS_URL is not configured. Please check your environment configuration.')
    }

    const redirectUrl = `${window.location.origin}${masRedirectPath || '/auth/matrix/callback'}`

    try {
      // Step 1: Discover and validate OIDC issuer configuration
      console.log('🔍 Discovering OIDC configuration from MAS issuer:', masUrl)
      const oidcConfig = await discoverAndValidateOIDCIssuerWellKnown(masUrl)

      console.log('✅ OIDC discovery successful:', {
        issuer: oidcConfig.issuer,
        authorizationEndpoint: oidcConfig.authorization_endpoint,
        tokenEndpoint: oidcConfig.token_endpoint
      })

      // Step 2: Register OAuth2 client dynamically (or use static client for tests)
      const useStaticClient = getEnv('APP_MAS_USE_STATIC_CLIENT') === 'true'
      const staticClientId = getEnv('APP_MAS_STATIC_TEST_CLIENT_ID') as string

      let clientId: string

      if (useStaticClient && staticClientId) {
        console.log('📝 Using static OAuth2 client for testing:', staticClientId)
        clientId = staticClientId
      } else {
        console.log('📝 Registering dynamic OAuth2 client with MAS')
        const clientRegistration = await this._registerOAuth2Client(masUrl, redirectUrl)
        clientId = clientRegistration.client_id
      }

      // Step 3: Generate authorization URL using native matrix-js-sdk
      const nonce = this._generateRandomState()
      const identityServerUrl = getEnv('APP_MATRIX_IDENTITY_SERVER_URL') as string || undefined

      console.log('🔗 Generating OIDC authorization URL with native SDK')
      const authorizationUrl = await generateOidcAuthorizationUrl({
        metadata: oidcConfig,
        clientId,
        homeserverUrl,
        identityServerUrl,
        redirectUri: redirectUrl,
        nonce,
        prompt: undefined // Let MAS decide the flow
      })

      // Enhance SDK-generated URL with tenant context parameters
      const enhancedUrl = new URL(authorizationUrl)
      const tenantId = (getEnv('APP_TENANT_ID') as string) || localStorage.getItem('tenantId')
      const userEmail = authStore.user?.email

      if (tenantId && userEmail) {
        // Add tenant ID to help backend identify the correct tenant context
        enhancedUrl.searchParams.set('tenantId', tenantId)

        // Add login hint with user email for seamless authentication
        enhancedUrl.searchParams.set('login_hint', userEmail)

        console.log('✅ Enhanced OIDC URL with tenant context:', {
          baseUrl: authorizationUrl,
          tenantId,
          loginHint: userEmail
        })

        // Perform full-page redirect to enhanced OIDC authorization URL (mobile-friendly)
        window.location.href = enhancedUrl.toString()
      } else {
        console.warn('⚠️ Missing tenant context - user may see email form:', {
          tenantId: !!tenantId,
          userEmail: !!userEmail
        })

        console.log('🔗 Redirecting to native OIDC authorization URL')
        console.log('🆔 Client ID:', clientId)
        console.log('🏠 Homeserver URL:', homeserverUrl)

        // Perform full-page redirect to OIDC authorization URL
        window.location.href = authorizationUrl
      }

      return new Promise(() => {
        // Promise never resolves since we're redirecting
      })
    } catch (error) {
      console.error('❌ Error during native OIDC authentication setup:', error)
      throw new Error(`Native OIDC authentication setup failed: ${error.message}`)
    }
  }

  /**
   * Register OAuth2 client dynamically with MAS (like Element-web)
   */
  private async _registerOAuth2Client (masUrl: string, redirectUrl: string): Promise<{client_id: string}> {
    // Extract base URL from redirect URL to ensure client_uri matches redirect domain
    const redirectUrlObj = new URL(redirectUrl)
    const clientUri = `${redirectUrlObj.protocol}//${redirectUrlObj.host}`

    // Match Element-web's exact registration format that works with MAS
    const registrationPayload = {
      client_name: 'OpenMeet',
      client_uri: clientUri, // Use same domain as redirect URL to satisfy policy
      response_types: ['code'],
      grant_types: ['authorization_code', 'refresh_token'],
      redirect_uris: [redirectUrl], // This is the only localhost URL needed
      id_token_signed_response_alg: 'RS256',
      token_endpoint_auth_method: 'none',
      application_type: 'web',
      logo_uri: `${clientUri}/openmeet/openmeet-logo.png` // Logo must be on same domain as client_uri
    }

    console.log('📝 Registering OAuth2 client:', registrationPayload)

    const response = await fetch(`${masUrl}/oauth2/registration`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(registrationPayload)
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('❌ OAuth2 client registration failed:', errorData)
      throw new Error(`Client registration failed: ${errorData.error_description || errorData.error || 'Unknown error'}`)
    }

    const clientData = await response.json()
    console.log('✅ OAuth2 client registered successfully:', clientData.client_id)
    return clientData
  }

  /**
   * Generate device ID for Matrix client (like Element-web)
   */
  private _generateDeviceId (): string {
    // Generate device ID similar to Element-web format
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    for (let i = 0; i < 10; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }

  /**
   * Build Matrix scopes including device-specific scope (like Element-web)
   */
  private _buildMatrixScopes (deviceId: string): string {
    const baseScopes = getEnv('APP_MAS_SCOPES') as string || 'openid urn:matrix:org.matrix.msc2967.client:api:*'
    const deviceScope = `urn:matrix:org.matrix.msc2967.client:device:${deviceId}`
    return `${baseScopes} ${deviceScope}`
  }

  /**
   * Generate random state parameter for OAuth2 CSRF protection
   */
  private _generateRandomState (): string {
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
  }

  // Note: Legacy SSO methods removed in favor of MAS OIDC flow
  // MAS handles the Matrix authentication internally

  // Note: Removed iframe/popup authentication methods in favor of full-page redirect
  // Full-page redirect is more reliable, mobile-friendly, and follows OAuth best practices

  /**
   * Exchange OAuth2 authorization code for Matrix credentials via MAS directly
   */
  private async _exchangeOIDCCodeForMatrixCredentials (authCode: string, state?: string | null): Promise<{
    userId: string;
    accessToken: string;
    deviceId: string;
    homeserverUrl: string;
  }> {
    console.log('🎫 Exchanging OAuth2 authorization code for Matrix credentials via MAS')

    try {
      // Get MAS configuration and dynamic client info
      const masUrl = getEnv('APP_MAS_URL') as string
      const masRedirectPath = getEnv('APP_MAS_REDIRECT_PATH') as string

      // Use static test client if configured for testing, otherwise use dynamic client
      const useStaticClient = getEnv('APP_MAS_USE_STATIC_CLIENT') === 'true'
      const staticTestClientId = getEnv('APP_MAS_STATIC_TEST_CLIENT_ID') as string
      const dynamicClientId = sessionStorage.getItem('mas_client_id')

      const clientId = useStaticClient && staticTestClientId ? staticTestClientId : dynamicClientId
      const storedDeviceId = sessionStorage.getItem('mas_device_id')

      if (!masUrl || !clientId) {
        throw new Error('MAS configuration not available - no client ID found')
      }

      const redirectUrl = `${window.location.origin}${masRedirectPath || '/auth/matrix/callback'}`

      console.log('🔧 Using client for token exchange:', {
        clientType: dynamicClientId ? 'dynamic' : 'static',
        clientId,
        deviceId: storedDeviceId,
        redirectUrl
      })

      // Call MAS directly to exchange authorization code for access token
      const response = await fetch(`${masUrl}/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: authCode,
          client_id: clientId, // Use dynamic or static client ID
          redirect_uri: redirectUrl,
          ...(state && { state })
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('❌ MAS token exchange failed:', errorData)

        // Throw the full error object for rate limiting detection
        const error = new Error(`MAS token exchange failed: ${errorData.error_description || errorData.error || 'Unknown error'}`)
        Object.assign(error, errorData)
        throw error
      }

      const tokenData = await response.json()
      console.log('✅ MAS token exchange successful, received token data:', tokenData)

      // Debug: Log what we received to understand the token structure
      console.log('🔍 Token data details:', {
        sub: tokenData.sub,
        access_token: tokenData.access_token,
        device_id: tokenData.device_id,
        token_type: tokenData.token_type,
        scope: tokenData.scope,
        expires_in: tokenData.expires_in,
        has_id_token: !!tokenData.id_token
      })

      const homeserverUrl = (getEnv('APP_MATRIX_HOMESERVER_URL') as string) || 'http://localhost:8448'
      console.log('🏠 Using homeserver URL:', homeserverUrl)

      // Extract Matrix credentials from MAS response using stored device ID
      let userId = tokenData.sub
      const deviceId = storedDeviceId || tokenData.device_id || this._generateDeviceId()

      // OPTIMIZATION: Get user info from MAS userinfo endpoint in parallel with token processing
      const userinfoPromise = (async () => {
        try {
          const masUrl = getEnv('APP_MAS_URL') as string
          const userinfoResponse = await fetch(`${masUrl}/oauth2/userinfo`, {
            headers: {
              Authorization: `Bearer ${tokenData.access_token}`
            }
          })

          if (userinfoResponse.ok) {
            const userInfo = await userinfoResponse.json()
            console.log('👤 MAS userinfo response:', userInfo)
            // Extract Matrix username from userinfo response
            // MAS returns the Matrix username in different possible fields
            return userInfo.matrix_handle || userInfo.preferred_username || userInfo.username
          } else {
            console.warn('⚠️ Failed to get userinfo from MAS:', userinfoResponse.status)
            return null
          }
        } catch (userinfoError) {
          console.error('❌ Error getting userinfo from MAS:', userinfoError)
          return null
        }
      })()

      // Now wait for userinfo result and update userId if available
      const userinfoUserId = await userinfoPromise
      if (userinfoUserId) {
        userId = userinfoUserId
        console.log('🔍 Updated userId from userinfo:', userId)
      }

      // Fallback: If userinfo failed, extract userId from the id_token JWT
      if (!userId && tokenData.id_token) {
        try {
          // Decode JWT payload (base64 decode the middle part)
          const jwtPayload = tokenData.id_token.split('.')[1]
          const decodedPayload = JSON.parse(atob(jwtPayload))
          userId = decodedPayload.sub
          console.log('🔍 Extracted userId from JWT id_token:', userId)
        } catch (jwtError) {
          console.error('❌ Failed to decode JWT id_token:', jwtError)
        }
      }

      // Format Matrix user ID properly (@username:server.name)
      let matrixUserId = userId
      if (userId && !userId.startsWith('@')) {
        // Use configured Matrix server name for user ID format (not homeserver URL hostname)
        const matrixServerName = getEnv('APP_MATRIX_SERVER_NAME') as string
        if (!matrixServerName) {
          throw new Error('APP_MATRIX_SERVER_NAME is required but not configured')
        }
        matrixUserId = `@${userId}:${matrixServerName}`
      }

      const credentials = {
        userId: matrixUserId, // Matrix user ID in proper format
        accessToken: tokenData.access_token,
        deviceId, // Use device ID from dynamic registration
        homeserverUrl,
        refreshToken: tokenData.refresh_token // Store refresh token if provided
      }

      console.log('🎫 Final Matrix credentials:', {
        userId: credentials.userId,
        hasAccessToken: !!credentials.accessToken,
        hasRefreshToken: !!credentials.refreshToken,
        accessTokenPrefix: credentials.accessToken?.substring(0, 10) + '...',
        refreshTokenPrefix: credentials.refreshToken?.substring(0, 10) + '...',
        deviceId: credentials.deviceId,
        homeserverUrl: credentials.homeserverUrl
      })

      // Validate that we have the required credentials
      if (!credentials.userId) {
        throw new Error('Failed to extract userId from MAS response')
      }
      if (!credentials.accessToken) {
        throw new Error('Failed to extract accessToken from MAS response')
      }

      return credentials
    } catch (error) {
      console.error('❌ Error exchanging OAuth2 code for Matrix credentials:', error)
      throw new Error(`Failed to exchange OAuth2 code: ${error.message}`)
    }
  }

  /**
   * Public method to get stored credentials - used by MatrixClientManager
   */
  async getStoredCredentials (): Promise<{ accessToken?: string; refreshToken?: string }> {
    const storedSession = this._getStoredCredentials()
    return {
      accessToken: storedSession?.accessToken,
      refreshToken: storedSession?.refreshToken
    }
  }

  /**
   * Check if user has previously connected to Matrix (has stored credentials)
   * This can be used to determine if auto-connect should happen
   */
  hasStoredSession (): boolean {
    const storedSession = this._getStoredCredentials()
    return !!(storedSession && storedSession.hasSession)
  }

  // Note: Removed unused session checking and interactive OIDC methods
  // Full-page redirect flow handles all authentication needs

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
          content: event.getContent(),
          timestamp: new Date(event.getTs()).toLocaleTimeString()
        })
        console.log('🔍 Current Matrix client user ID:', this.client.getUserId())
        console.log('🔍 Event sender ID:', event.getSender())
        console.log('🔍 Is this our own message?', event.getSender() === this.client.getUserId())
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
    this.client.on(ClientEvent.Sync, async (state: string, prevState: string | null, data: unknown) => {
      console.log(`🔄 Matrix sync state: ${prevState} → ${state}`, data)

      // Emit connection state events for UI components
      const connectionStateEvent = new CustomEvent('matrix:connectionState', {
        detail: {
          state,
          prevState,
          data,
          timestamp: Date.now()
        }
      })
      window.dispatchEvent(connectionStateEvent)

      if (state === 'PREPARED') {
        console.log('✅ Matrix client fully synced and ready')
        // Additional debugging: Check if we have rooms and they're getting events
        const rooms = this.client.getRooms()
        console.log(`📊 Matrix client has ${rooms.length} rooms after sync`)

        // Emit ready event
        const readyEvent = new CustomEvent('matrix:ready', {
          detail: {
            roomCount: rooms.length,
            timestamp: Date.now()
          }
        })
        window.dispatchEvent(readyEvent)
      } else if (state === 'SYNCING') {
        console.log('🔄 Matrix client syncing...')
      } else if (state === 'ERROR') {
        console.error('❌ Matrix sync error:', data)

        // Check if this is a token-related error
        const isTokenError = this._isInvalidTokenError(data)

        // Emit sync error event with token error flag
        const syncErrorEvent = new CustomEvent('matrix:syncError', {
          detail: {
            error: data,
            isTokenError,
            timestamp: Date.now()
          }
        })
        window.dispatchEvent(syncErrorEvent)

        // Handle token errors with native SDK OIDC support
        if (isTokenError) {
          console.warn('🚫 Token-related sync error detected - with native SDK OIDC, tokens should refresh automatically')
          console.log('💡 If we hit this, the refresh token is likely invalid - clearing session for re-authentication')

          // With native SDK OIDC support, token refresh should be automatic
          // If we're still getting token errors, the refresh token is likely invalid
          await this.clearSession()
          const tokenRefreshFailureEvent = new CustomEvent('matrix:tokenRefreshFailure', {
            detail: {
              error: data,
              reason: 'invalid_refresh_token',
              timestamp: Date.now()
            }
          })
          window.dispatchEvent(tokenRefreshFailureEvent)
          return
        }

        // Attempt to restart sync after a delay for non-token errors
        // Add throttling to prevent infinite restart loops
        if (!this._lastRestartAttempt || (Date.now() - this._lastRestartAttempt) > 30000) {
          setTimeout(async () => {
            if (this.client && this.client.getSyncState() === 'ERROR') {
              console.log('🔄 Restarting Matrix sync after error...')
              this._lastRestartAttempt = Date.now()
              try {
                await matrixClientManager.restartClient()
              } catch (error) {
                console.error('❌ Failed to restart Matrix sync:', error)
              }
            }
          }, 5000)
        } else {
          console.log('⏳ Skipping Matrix restart - throttled (last attempt was too recent)')
        }
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
    this.client.on(RoomMemberEvent.Membership, async (event: MatrixEvent, member: RoomMember) => {
      const membership = (member as unknown as { membership: string }).membership
      console.log('👥 Room membership change:', member.userId, membership)

      // Auto-join rooms when invited
      if (membership === 'invite' && member.userId === this.client?.getUserId()) {
        const roomId = event.getRoomId()
        console.log(`🎯 Auto-joining room ${roomId} after receiving invitation`)
        try {
          await this.joinRoom(roomId)
          console.log(`✅ Successfully auto-joined room ${roomId}`)
        } catch (error) {
          console.error(`❌ Failed to auto-join room ${roomId}:`, error)
        }
      }
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

    // Note: Components should listen directly to Matrix SDK events
    // No custom event emission needed - following Element-web pattern
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
  async sendMessage (roomId: string, content: MatrixMessageContent): Promise<{ eventId: string }> {
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
      const result = await this.client.sendEvent(roomId, EventType.RoomMessage, content as any)
      console.log('📤 Message sent successfully to room:', roomId, 'eventId:', result.event_id)

      return { eventId: result.event_id }
    } catch (error) {
      console.error('❌ Failed to send message:', error)

      // Check if this is an authentication error and clear corrupted tokens
      // Note: With proper SDK token refresh configuration, this should rarely happen
      if (this._isInvalidTokenError(error)) {
        console.warn('🚫 Invalid access token detected during message send - SDK token refresh may have failed')
        this._clearStoredCredentials()

        // Emit token error event
        const tokenErrorEvent = new CustomEvent('matrix:tokenError', {
          detail: {
            error,
            context: 'message_send',
            timestamp: Date.now()
          }
        })
        window.dispatchEvent(tokenErrorEvent)

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

        // Emit token error event
        const tokenErrorEvent = new CustomEvent('matrix:tokenError', {
          detail: {
            error,
            context: 'read_receipt',
            timestamp: Date.now()
          }
        })
        window.dispatchEvent(tokenErrorEvent)

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
    console.log('🚀 ENTRY: uploadAndSendFile called with:', { fileName: file.name, roomId })

    console.log('🔍 ENTRY: Checking Matrix client...')
    if (!this.client) {
      console.error('🚨 ENTRY: Matrix client not initialized!')
      throw new Error('Matrix client not initialized')
    }

    console.log('🚀 ENTRY: Matrix client is available, proceeding...')

    // Use a completely separate try-catch to isolate the issue
    let contentUri = ''

    console.log('📎 Starting uploadAndSendFile for:', file.name)
    console.log('🔄 Step 1: Uploading file to Matrix media repository...')

    try {
      console.log('🔄 Step 1a: About to call uploadFile...')
      contentUri = await this.uploadFile(file)
      console.log('✅ Step 1b: uploadFile returned:', contentUri)
    } catch (uploadError) {
      console.error('❌ Step 1 FAILED: Upload error:', uploadError)
      throw uploadError
    }

    console.log('✅ Step 1 complete: File uploaded, got content URI:', contentUri)

    console.log('🔄 Step 2: Preparing message content...')

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

    console.log('📝 Message content prepared:', {
      msgtype,
      filename: file.name,
      size: file.size,
      contentUri
    })

    console.log('🔄 Step 3: Sending message to room...')

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.client.sendEvent(roomId, EventType.RoomMessage, content as any)
      console.log('✅ Step 3 complete: Message sent to room:', roomId)
      console.log('🎉 File upload and send process completed successfully!')
    } catch (sendError) {
      console.error('❌ Step 3 FAILED: Send error:', sendError)
      throw sendError
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
        console.log('🔄 Transformed to v1 download endpoint:', httpUrl)
      } else if (httpUrl.includes('/_matrix/media/v3/thumbnail/')) {
        httpUrl = httpUrl.replace('/_matrix/media/v3/thumbnail/', '/_matrix/client/v1/media/thumbnail/')
        console.log('🔄 Transformed to v1 thumbnail endpoint:', httpUrl)
      }

      return httpUrl
    } catch (error) {
      console.warn('⚠️ Failed to convert Matrix content URL:', mxcUrl, error)
      return mxcUrl
    }
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
        throw new Error('Matrix session expired. Please reconnect to access the chatroom.')
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
      console.log('🔄 uploadFile: Starting upload to Matrix media repository...')
      console.log('🔄 uploadFile: File details:', {
        name: file.name,
        size: file.size,
        type: file.type
      })
      console.log('🔄 uploadFile: Matrix client ready, calling uploadContent...')

      const upload = await this.client.uploadContent(file)

      console.log('✅ uploadFile: Upload successful!')
      console.log('📎 uploadFile: File uploaded with content URI:', upload.content_uri)
      console.log('📎 uploadFile: Full upload response:', upload)

      return upload.content_uri
    } catch (error) {
      console.error('❌ uploadFile: Failed to upload file:', error)

      // Provide more user-friendly error messages for common issues
      if (error instanceof Error) {
        // Check for network/CORS errors that often indicate file size limits or timeouts
        if (error.message === '' && error.stack?.includes('onreadystatechange')) {
          throw new Error('Upload failed: File may be too large or connection timed out. Try a smaller file.')
        }

        // Check for DOMException which often indicates CORS/network issues from large files
        if (error.constructor.name === 'DOMException') {
          throw new Error('Upload failed: The file may be too large for the server. Try a smaller file.')
        }
      }

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
   * Join an event chat room by event slug using Matrix-native room aliases
   */
  async joinEventChatRoom (eventSlug: string): Promise<{ room: Room; roomInfo: unknown }> {
    if (!this.client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      console.log('🎪 Joining event chat room for event:', eventSlug)

      // Matrix-native approach: Use room aliases instead of backend API calls
      const tenantId = (getEnv('APP_TENANT_ID') as string) || localStorage.getItem('tenantId')
      if (!tenantId) {
        throw new Error('Tenant ID not available')
      }

      // Import room alias utility (assuming it's added to matrixUtils)
      const { generateEventRoomAlias } = await import('../utils/matrixUtils')
      const roomAlias = generateEventRoomAlias(eventSlug, tenantId)

      console.log('🏠 Generated room alias:', roomAlias)

      // First, ensure the room exists by querying the alias
      // This will trigger Application Service room creation if the room doesn't exist
      let roomId: string
      try {
        console.log('🔍 Resolving room alias to trigger Application Service if needed...')
        const aliasResult = await this.client.getRoomIdForAlias(roomAlias)
        roomId = aliasResult.room_id
        console.log('✅ Room alias resolved to room ID:', roomId)
      } catch (aliasError) {
        console.log('⚠️ Room alias not found, attempting direct join which may trigger creation')
        // If alias resolution fails, the room might not exist yet
        // Try direct join which might work if Application Service creates it immediately
        roomId = roomAlias // Fallback to using alias as room identifier
      }

      // Now join the room using the resolved room ID or alias
      const room = await this.joinRoom(roomId)

      console.log('✅ Joined event chat room via room alias:', roomAlias)
      return {
        room,
        roomInfo: {
          matrixRoomId: room.roomId,
          roomAlias,
          source: 'matrix-native'
        }
      }
    } catch (error) {
      console.error('❌ Failed to join event chat room:', error)
      throw error
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
        console.log('🛑 Stopping Matrix client (local session cleanup)')

        // Skip leaving rooms - this is a local session cleanup only
        // Leaving rooms would affect other Matrix clients using the same account
        console.log('ℹ️ Performing local session cleanup without leaving Matrix rooms')

        this.client.stopClient()
        this.client = null
      }

      // Clear localStorage and sessionStorage session info (contains tenant-specific session data)
      this._clearStoredCredentials()

      // Clear IndexedDB crypto store data (user-specific encryption data)
      if (storedSession) {
        try {
          // Get current user slug for database cleanup
          const authStore = useAuthStore()
          const userSlug = authStore.getUserSlug

          if (userSlug) {
            // Clear new slug-based storage
            const cryptoStoreName = `matrix-crypto-${userSlug}-${storedSession.userId}`
            const mainStoreName = `matrix-store-${userSlug}-${storedSession.userId}`

            console.log(`🗑️ Clearing user-specific Matrix stores: ${cryptoStoreName}, ${mainStoreName}`)

            const deleteCrypto = indexedDB.deleteDatabase(cryptoStoreName)
            deleteCrypto.onsuccess = () => console.log('✅ Cleared Matrix IndexedDB crypto store')
            deleteCrypto.onerror = (e) => console.warn('⚠️ Failed to clear crypto IndexedDB:', e)

            const deleteMain = indexedDB.deleteDatabase(mainStoreName)
            deleteMain.onsuccess = () => console.log('✅ Cleared Matrix IndexedDB main store')
            deleteMain.onerror = (e) => console.warn('⚠️ Failed to clear main IndexedDB:', e)
          }

          // Also clean up legacy storage that might exist
          const legacyCryptoName = `matrix-crypto-${storedSession.userId}`
          const legacyMainName = `matrix-store-${storedSession.userId}`

          const deleteLegacyCrypto = indexedDB.deleteDatabase(legacyCryptoName)
          deleteLegacyCrypto.onsuccess = () => console.log('✅ Cleared legacy Matrix crypto store')
          deleteLegacyCrypto.onerror = () => {} // Ignore errors for legacy cleanup

          const deleteLegacyMain = indexedDB.deleteDatabase(legacyMainName)
          deleteLegacyMain.onsuccess = () => console.log('✅ Cleared legacy Matrix main store')
          deleteLegacyMain.onerror = () => {} // Ignore errors for legacy cleanup
        } catch (error) {
          console.warn('⚠️ Failed to clear IndexedDB stores:', error)
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
   * Join a group chat room by group slug using Matrix-native room aliases
   */
  async joinGroupChatRoom (groupSlug: string): Promise<{ room: Room; roomInfo: unknown }> {
    if (!this.client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      console.log('👥 Joining group chat room for group:', groupSlug)

      // Matrix-native approach: Use room aliases instead of backend API calls
      const tenantId = (getEnv('APP_TENANT_ID') as string) || localStorage.getItem('tenantId')
      if (!tenantId) {
        throw new Error('Tenant ID not available')
      }

      // Import room alias utility
      const { generateGroupRoomAlias } = await import('../utils/matrixUtils')
      const roomAlias = generateGroupRoomAlias(groupSlug, tenantId)

      console.log('🏠 Generated room alias:', roomAlias)

      // Join the Matrix room directly using the room alias
      // The Matrix Application Service will create the room on-demand if it doesn't exist
      const room = await this.joinRoom(roomAlias)

      console.log('✅ Joined group chat room via room alias:', roomAlias)
      return {
        room,
        roomInfo: {
          matrixRoomId: room.roomId,
          roomAlias,
          source: 'matrix-native'
        }
      }
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
    // Always use the client from MatrixClientManager if available
    const managerClient = matrixClientManager.getClient()
    if (managerClient) {
      this.client = managerClient
    }

    if (!this.client) {
      console.warn('Matrix client not initialized for getRoom call')
      return null
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
   * Manually connect to Matrix (for user-initiated connection)
   */
  async connect (): Promise<MatrixClient> {
    console.log('🔌 Manual Matrix connection initiated')
    return this.initializeClient(true)
  }

  /**
   * Connect to Matrix after user has explicitly chosen to do so
   * Sets user consent flag and initiates connection
   */
  async connectToMatrix (): Promise<MatrixClient> {
    // Set flag indicating user has explicitly chosen to connect
    this.setUserChosenToConnect(true)
    return this.connect()
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
    refreshToken?: string
  }): void {
    try {
      // Get current OpenMeet user slug for user-specific storage keys
      const authStore = useAuthStore()
      const openMeetUserSlug = authStore.getUserSlug

      if (!openMeetUserSlug) {
        console.warn('⚠️ No OpenMeet user slug available, using Matrix user ID for storage key')
      }

      // Create user-specific storage keys to prevent session sharing between users
      const storageUserId = openMeetUserSlug || credentials.userId
      const accessTokenKey = `matrix_access_token_${storageUserId}`
      const refreshTokenKey = `matrix_refresh_token_${storageUserId}`
      const sessionKey = `matrix_session_${storageUserId}`

      // Use sessionStorage for access token (cleared on tab close) for better security
      // Use localStorage for refresh token (persists for token refresh) and basic session info
      sessionStorage.setItem(accessTokenKey, credentials.accessToken)

      if (credentials.refreshToken) {
        localStorage.setItem(refreshTokenKey, credentials.refreshToken)
      }

      const basicSessionData = {
        homeserverUrl: credentials.homeserverUrl,
        userId: credentials.userId,
        deviceId: credentials.deviceId,
        timestamp: Date.now(),
        hasSession: true,
        openMeetUserSlug: storageUserId // Store for validation
        // OIDC configuration is now handled by Element Web's persistOidcAuthenticatedSettings()
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
    refreshToken?: string
    timestamp: number
    hasSession: boolean
  } | null {
    try {
      // Get current OpenMeet user slug for user-specific storage keys
      const authStore = useAuthStore()
      const openMeetUserSlug = authStore.getUserSlug

      if (!openMeetUserSlug) {
        console.log('🔍 No OpenMeet user slug available, checking for legacy session')
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
      const accessTokenKey = `matrix_access_token_${openMeetUserSlug}`
      const refreshTokenKey = `matrix_refresh_token_${openMeetUserSlug}`
      const sessionKey = `matrix_session_${openMeetUserSlug}`

      const stored = localStorage.getItem(sessionKey)
      if (!stored) {
        console.log(`🔍 No Matrix session found for user ${openMeetUserSlug}`)
        return null
      }

      const sessionData = JSON.parse(stored)

      // Validate that this session belongs to the current user
      if (sessionData.openMeetUserSlug && sessionData.openMeetUserSlug !== openMeetUserSlug) {
        console.warn(`🚨 Session user mismatch: stored=${sessionData.openMeetUserSlug}, current=${openMeetUserSlug}`)
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

      // Try to get refresh token from localStorage (persists longer)
      const refreshToken = localStorage.getItem(refreshTokenKey)

      // If access token is available and not too old, include it
      if (accessToken && (Date.now() - sessionData.timestamp) < accessTokenMaxAge) {
        sessionData.accessToken = accessToken
        console.log('🔑 Found stored access token for immediate restoration')
      } else if (refreshToken) {
        console.log('🔄 No valid access token found, but refresh token available')
      } else {
        console.log('🔑 No valid access token or refresh token found, will attempt silent auth')
      }

      // Always include refresh token if available (needed for token refresh)
      if (refreshToken) {
        sessionData.refreshToken = refreshToken
        console.log('🔄 Found stored refresh token for token refresh capability')
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
      const openMeetUserSlug = authStore.getUserId

      if (openMeetUserSlug) {
        // Clear user-specific storage
        const accessTokenKey = `matrix_access_token_${openMeetUserSlug}`
        const refreshTokenKey = `matrix_refresh_token_${openMeetUserSlug}`
        const sessionKey = `matrix_session_${openMeetUserSlug}`
        localStorage.removeItem(sessionKey)
        localStorage.removeItem(refreshTokenKey)
        sessionStorage.removeItem(accessTokenKey)
        console.log(`🗑️ Cleared Matrix session info for user ${openMeetUserSlug}`)
      } else {
        console.log('🗑️ No user ID available, clearing legacy session keys')
      }

      // Clear OIDC settings using Element Web's pattern
      clearStoredOidcSettings()
      console.log('🗑️ Cleared OIDC authentication settings')

      // Also clear legacy keys for cleanup
      localStorage.removeItem('matrix_session')
      sessionStorage.removeItem('matrix_access_token')
    } catch (error) {
      console.warn('⚠️ Failed to clear stored session:', error)
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
    refreshToken?: string
  }): Promise<MatrixClient | null> {
    try {
      console.log('🔄 Attempting to restore Matrix client from stored credentials')

      // Check if we have credentials for restoration
      if (sessionInfo.accessToken || sessionInfo.refreshToken) {
        console.log('🔑 Using stored credentials for client restoration', {
          hasAccessToken: !!sessionInfo.accessToken,
          hasRefreshToken: !!sessionInfo.refreshToken
        })

        // Validate homeserver URL format
        const baseUrl = sessionInfo.homeserverUrl.endsWith('/')
          ? sessionInfo.homeserverUrl.slice(0, -1)
          : sessionInfo.homeserverUrl

        console.log('🏠 Restoring Matrix client with baseUrl:', baseUrl)

        // If no access token but we have refresh token, try to get new access token
        const accessToken = sessionInfo.accessToken
        const refreshToken = sessionInfo.refreshToken

        // With native SDK OIDC support, we don't need to manually refresh tokens here
        // The SDK will handle token refresh automatically when configured with refreshToken
        if (!accessToken && refreshToken) {
          console.log('🔄 No access token available, but refresh token present - SDK will handle refresh automatically')
        }

        if (!accessToken) {
          console.log('🔑 No valid access token available - user needs to authenticate')
          return null // Return null to indicate authentication is needed
        }

        // With native SDK OIDC support, we no longer provide custom tokenRefreshFunction
        // The SDK handles token refresh internally when refreshToken is provided in createClient options
        console.log('🔄 Using native SDK OIDC token refresh - no custom tokenRefreshFunction needed')

        // MSC3861: Use access token obtained via MAS OIDC with refresh token support
        console.log('🔐 Restoring Matrix client with MSC3861 access token from MAS', {
          hasRefreshToken: !!refreshToken,
          usesNativeSDKRefresh: true
        })

        // Create persistent IndexedDB store for main storage
        let store = new IndexedDBStore({
          indexedDB,
          dbName: `matrix-store-${sessionInfo.userId}`,
          localStorage: window.localStorage
        })

        // CRITICAL: Set user creator before store startup (Matrix-js-sdk v30+ requirement)
        store.setUserCreator((userId: string) => {
          return new User(userId)
        })

        // CRITICAL: Await store startup before creating client (required for IndexedDB initialization)
        console.log('🔄 Starting IndexedDB store during restoration...')
        try {
          await store.startup()
          console.log('✅ IndexedDB store startup completed during restoration')
        } catch (error) {
          console.warn('⚠️ IndexedDB store startup failed during restoration, clearing incompatible data:', error)
          if (error.message && error.message.includes('setPresenceEvent')) {
            console.log('🧹 Clearing incompatible presence data and retrying restoration...')
            // Clear the problematic database and recreate
            try {
              const dbName = `matrix-store-${sessionInfo.userId}`
              await this._clearIncompatibleStoreData(dbName)
              // Recreate store after clearing incompatible data
              store = new IndexedDBStore({
                indexedDB,
                dbName,
                localStorage: window.localStorage
              })
              store.setUserCreator((userId: string) => {
                return new User(userId)
              })
              await store.startup()
              console.log('✅ IndexedDB store recreated successfully during restoration after clearing incompatible data')
            } catch (retryError) {
              console.error('❌ Failed to recreate store during restoration, falling back to memory store:', retryError)
              throw error // Re-throw original error
            }
          } else {
            throw error // Re-throw if not a known compatibility issue
          }
        }

        // Use MatrixClientManager instead of direct client creation
        console.log('🔄 Using MatrixClientManager for client initialization...')

        // Use Element Web's OIDC persistence pattern (consistent approach)
        const oidcIssuer = getStoredOidcTokenIssuer()
        const oidcClientId = getStoredOidcClientId()
        const idTokenClaims = getStoredOidcIdTokenClaims()

        console.log('🔍 Session restoration credentials (Element Web approach):', {
          hasRefreshToken: !!refreshToken,
          hasOidcIssuer: !!oidcIssuer,
          hasOidcClientId: !!oidcClientId,
          oidcIssuer,
          oidcClientId,
          usingElementWebStorage: true
        })

        this.client = await matrixClientManager.initializeClient({
          homeserverUrl: baseUrl,
          accessToken: accessToken!,
          userId: sessionInfo.userId,
          deviceId: sessionInfo.deviceId,
          refreshToken,
          // Use Element Web's OIDC persistence pattern for TokenRefresher creation
          oidcIssuer,
          oidcClientId,
          oidcRedirectUri: `${window.location.origin}/auth/matrix`,
          idTokenClaims
        })

        console.log('✅ Matrix client restored successfully via MatrixClientManager')

        // Set up event listeners
        this._setupEventListeners()

        // Start the client (MatrixClientManager handles this internally)
        await matrixClientManager.startClient()

        return this.client // Return the successfully created client
      } else {
        // Fallback: try to restore from Matrix SDK's own persistence
        console.log('🔄 No access token available, trying Matrix SDK restoration')

        // No access token available, can't create working client
        console.log('❌ No access token available, cannot create Matrix client without authentication')
        return null // Return null to indicate authentication is needed
      }
    } catch (error) {
      console.warn('⚠️ Failed to restore Matrix client from storage:', error)

      // Check if this is an authentication error and clear corrupted tokens
      if (this._isInvalidTokenError(error) || (error.message && error.message.includes('invalid_grant'))) {
        console.warn('🚫 Invalid access token detected during restoration - clearing stored credentials')
        this._clearStoredCredentials()
        return null // Return null to allow re-authentication instead of throwing
      }

      throw error
    }
  }

  /**
   * Wait for room to be ready for operations after Matrix sync
   * Follows Element-web pattern for safe room access
   */
  async waitForRoomReady (roomId: string): Promise<Room | null> {
    if (!this.client) {
      throw new Error('Matrix client not initialized')
    }

    // Wait for client to reach PREPARED sync state
    if (this.client.getSyncState() !== 'PREPARED') {
      console.log('⏳ Waiting for Matrix client sync to reach PREPARED state...')
      await new Promise<void>((resolve, reject) => {
        const onSyncStateChange = (state: string) => {
          console.log('🔄 Matrix sync state changed to:', state)
          if (state === 'PREPARED') {
            this.client?.off(ClientEvent.Sync, onSyncStateChange)
            resolve()
          } else if (state === 'ERROR') {
            this.client?.off(ClientEvent.Sync, onSyncStateChange)
            reject(new Error('Matrix sync failed'))
          }
        }
        this.client?.on(ClientEvent.Sync, onSyncStateChange)
      })
    }

    // Get room using Matrix JS SDK directly
    const room = this.client.getRoom(roomId)
    if (!room) {
      console.warn(`⚠️ Room ${roomId} not found in Matrix client after sync`)
      return null
    }

    console.log(`✅ Room ${roomId} ready for operations`)
    return room
  }

  // Removed _attemptSilentAuth - replaced with MAS OIDC flow
  // Silent authentication now handled by MAS with user tokens

  // Removed _performSilentOIDCAuth - iframe auth not needed with MAS
  // MAS provides seamless authentication via server-side token validation

  // Removed _buildOIDCUrl - direct Matrix URLs not used with MAS
  // MAS handles Matrix authentication through backend OIDC endpoints

  /**
   * Sync Matrix user identity with backend after successful MAS authentication
   */
  private async _syncMatrixUserIdentityWithBackend (matrixUserId: string): Promise<void> {
    try {
      console.log('🔄 Syncing Matrix user identity with backend:', matrixUserId)

      const { matrixApi } = await import('../api/matrix')
      const response = await matrixApi.syncUserIdentity(matrixUserId)

      if (!response.data.success) {
        throw new Error('Failed to sync Matrix user identity')
      }

      console.log('✅ Matrix user identity synced with backend:', response.data)
    } catch (error) {
      console.error('❌ Failed to sync Matrix user identity with backend:', error)
      // Don't throw - this is non-critical for Matrix functionality
      // The user can still use Matrix, they just won't get auto-invitations until this is fixed
    }
  }

  /**
   * Handle invalid refresh token by completely resetting Matrix state
   * This stops all retry loops and clears everything to allow fresh authentication
   */
  private async _handleInvalidRefreshToken (): Promise<void> {
    try {
      console.warn('🚨 Handling invalid refresh token - performing complete Matrix reset')

      // Stop all Matrix clients immediately
      if (this.client) {
        this.client.stopClient()
        this.client = null
      }

      // Use MatrixClientManager's specialized method for clearing client and credentials
      await matrixClientManager.clearClientAndCredentials()

      // Emit an event that the UI can listen for to show re-authentication prompt
      const invalidTokenEvent = new CustomEvent('matrix:invalidTokenRecovery', {
        detail: {
          message: 'Matrix authentication expired. Please refresh the page to re-authenticate.',
          timestamp: Date.now()
        }
      })
      window.dispatchEvent(invalidTokenEvent)

      console.log('✅ Invalid refresh token recovery completed - user needs to re-authenticate')
    } catch (error) {
      console.error('❌ Error during invalid token recovery:', error)
    }
  }

  /**
   * Clear all Matrix sessions and storage (for troubleshooting)
   * This will force users to re-authenticate with Matrix
   */
  async clearAllMatrixSessions (): Promise<void> {
    try {
      console.log('🧹 Clearing all Matrix sessions and storage...')

      // Stop and clear current client
      if (this.client) {
        this.client.stopClient()
        this.client = null
        console.log('✅ Matrix client stopped and cleared')
      }

      // Clear all Matrix-related localStorage items
      const keysToRemove = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && (key.startsWith('matrix_') || key.startsWith('mas_'))) {
          keysToRemove.push(key)
        }
      }

      keysToRemove.forEach(key => {
        localStorage.removeItem(key)
        console.log(`🗑️ Removed localStorage key: ${key}`)
      })

      // Clear all Matrix IndexedDB stores
      const databases = await indexedDB.databases()
      for (const db of databases) {
        if (db.name && (db.name.includes('matrix-crypto-') || db.name.includes('matrix-store-'))) {
          const deleteRequest = indexedDB.deleteDatabase(db.name)
          deleteRequest.onsuccess = () => console.log(`🗑️ Deleted IndexedDB: ${db.name}`)
          deleteRequest.onerror = () => console.warn(`❌ Failed to delete IndexedDB: ${db.name}`)
        }
      }

      console.log('✅ All Matrix sessions and storage cleared')
      console.log('ℹ️ User will need to re-authenticate with Matrix on next access')
    } catch (error) {
      console.error('❌ Error clearing Matrix sessions:', error)
      throw error
    }
  }

  /**
   * Clear incompatible IndexedDB store data when SDK version changes
   * This handles cases where stored presence data format is incompatible with current SDK
   *
   * @param dbName - Name of the IndexedDB database to clear
   */
  private async _clearIncompatibleStoreData (dbName: string): Promise<void> {
    try {
      console.log(`🧹 Clearing incompatible IndexedDB store: ${dbName}`)

      // Delete the entire database to clear incompatible data
      const deleteRequest = indexedDB.deleteDatabase(dbName)

      await new Promise<void>((resolve, reject) => {
        deleteRequest.onsuccess = () => {
          console.log(`✅ Successfully cleared incompatible store: ${dbName}`)
          resolve()
        }
        deleteRequest.onerror = (event) => {
          console.error(`❌ Failed to clear incompatible store: ${dbName}`, event)
          reject(new Error(`Failed to delete database: ${dbName}`))
        }
        deleteRequest.onblocked = () => {
          console.warn(`⚠️ Database deletion blocked for: ${dbName}`)
          // Still resolve as the database will be cleared when other connections close
          resolve()
        }
      })
    } catch (error) {
      console.error(`❌ Error clearing incompatible store data for ${dbName}:`, error)
      throw error
    }
  }

  /**
   * Force Matrix client to sync after backend bot invitation
   * This ensures the client picks up new room invitations immediately
   *
   * @param contextType - Type of context (event/group) for logging
   * @param contextId - ID of the context for logging
   */
  async forceSyncAfterInvitation (contextType: string, contextId: string): Promise<void> {
    console.log(`🔄 Forcing Matrix client sync after ${contextType} invitation: ${contextId}`)

    const client = this.getClient()
    if (!client) {
      console.warn('⚠️ No Matrix client available for force sync')
      return
    }

    try {
      // Stop and restart the client to force a fresh sync
      console.log('🛑 Stopping Matrix client to force sync...')
      client.stopClient()

      // Wait a moment then restart to pick up new room
      await new Promise(resolve => setTimeout(resolve, 1000))
      console.log('🔄 Restarting Matrix client...')
      await matrixClientManager.restartClient()
      console.log('✅ Matrix client restarted and syncing')

      // Wait for sync to complete
      await new Promise(resolve => setTimeout(resolve, 2000))
      console.log('✅ Matrix client force sync completed')
    } catch (error) {
      console.error('❌ Error during Matrix client force sync:', error)
      throw error
    }
  }

  /**
   * Parse JWT claims from ID token (for OIDC TokenRefresher)
   */
  private _parseJWTClaims (idToken: string): IdTokenClaims {
    try {
      // JWT tokens have 3 parts separated by dots: header.payload.signature
      const parts = idToken.split('.')
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format')
      }

      // Decode the payload (second part)
      const payload = parts[1]
      // Add padding if needed for base64 decoding
      const paddedPayload = payload + '='.repeat((4 - payload.length % 4) % 4)
      const decoded = atob(paddedPayload.replace(/-/g, '+').replace(/_/g, '/'))

      return JSON.parse(decoded) as IdTokenClaims
    } catch (error) {
      console.warn('⚠️ Failed to parse ID token claims:', error)
      return {} as IdTokenClaims
    }
  }
}

// Export singleton instance
export const matrixClientService = new MatrixClientService()
export default matrixClientService
