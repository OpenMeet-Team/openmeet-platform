import { AxiosResponse } from 'axios'
import { api } from '../boot/axios'
import { MatrixMessage } from '../types/matrix'
import { useAuthStore } from '../stores/auth-store'
import { io, Socket } from 'socket.io-client'
import matrixTokenService from '../services/matrixTokenService'

export const matrixApi = {
  // Set Matrix password for direct client access
  setPassword: (password: string): Promise<AxiosResponse<{ success: boolean; message: string }>> =>
    api.post('/api/matrix/set-password', { password }),

  // Send typing indicator to a room
  sendTyping: (roomId: string, isTyping: boolean): Promise<AxiosResponse<void>> =>
    api.post(`/api/matrix/${roomId}/typing`, { isTyping }),

  // Create WebSocket connection for Matrix events
  createSocketConnection: async (): Promise<Socket> => {
    // Check for Cypress test environment
    const isCypress = typeof window !== 'undefined' && 'Cypress' in window

    // Add type declaration for Cypress on window object
    interface CypressGlobal {
      env: (key: string) => string | undefined;
    }

    interface WindowWithCypress extends Window {
      Cypress?: CypressGlobal;
    }

    // Special handling for Cypress tests
    let cypressApiUrl = ''
    if (isCypress) {
      const cypressWindow = window as WindowWithCypress
      cypressApiUrl = cypressWindow.Cypress?.env('APP_TESTING_API_URL') || ''
      console.log('Cypress test detected, API URL from Cypress env:', cypressApiUrl)
    }

    // Use the API URL from the app config
    // This ensures we connect to the backend API, not the frontend webapp
    const apiBaseUrl = window.APP_CONFIG?.APP_API_URL || ''

    // Check for overridden API URL (ngrok or other proxy)
    const overrideUrl = window.__MATRIX_API_URL__ || ''

    // Get Matrix API URL from config
    const matrixApiUrl = window.APP_CONFIG?.APP_MATRIX_API_URL

    // Use Cypress API URL if available, then override if available,
    // otherwise use the Matrix API URL from config, then fall back to regular API URL
    let baseUrl = cypressApiUrl || overrideUrl || matrixApiUrl || apiBaseUrl

    // Log the API URL we're using
    console.log('Using Matrix API URL for connection:', baseUrl)

    // If we're in development and no baseUrl is configured, try localhost
    if (!baseUrl && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
      baseUrl = window.location.origin
      console.log('No API URL configured, defaulting to current origin for WebSocket:', baseUrl)
    }

    if (!baseUrl) {
      console.error('No API URL found. Make sure APP_API_URL is configured in config.json')
      throw new Error('Cannot connect to Matrix: API URL not configured')
    }

    // WebSocket namespace for Matrix events
    const endpoint = `${baseUrl}/matrix`
    console.log('Creating WebSocket connection to Matrix at:', endpoint)

    // Log that we're attempting to establish a WebSocket connection
    console.log('Attempting to establish WebSocket connection for real-time Matrix events')

    // Get token from the auth store - ALWAYS USE THE USER'S AUTH TOKEN for WebSocket
    let token = ''
    try {
      const authStore = useAuthStore()

      if (!authStore.isAuthenticated) {
        console.warn('Auth store reports user is not authenticated')
      }

      // Use the user's regular auth token for WebSocket connection
      token = authStore.token
      console.log('Using auth token for WebSocket:', token ? `Length: ${token.length}` : 'No token in store')

      // Validate that we have a non-empty token
      if (!token || token.length < 10) {
        // Try localStorage as backup
        let localToken = localStorage.getItem('token')

        // Handle Quasar's __q_strn| prefix if present
        if (localToken && localToken.startsWith('__q_strn|')) {
          localToken = localToken.substring('__q_strn|'.length)
          console.log('Removed Quasar prefix from localStorage token')
        }

        if (localToken && localToken.length > 10) {
          console.log('Using token from localStorage instead of empty store token')
          token = localToken
        } else {
          console.warn('No valid token found in authStore or localStorage')
        }
      }
    } catch (e) {
      console.warn('Error accessing auth store, falling back to localStorage', e)
      let localToken = localStorage.getItem('token') || ''

      // Handle Quasar's __q_strn| prefix if present
      if (localToken && localToken.startsWith('__q_strn|')) {
        localToken = localToken.substring('__q_strn|'.length)
        console.log('Removed Quasar prefix from fallback localStorage token')
      }

      token = localToken
      console.log('Token from localStorage:', token ? `Length: ${token.length}` : 'No token in localStorage')
    }

    // Get tenant ID from config - this is CRITICAL for the server to work properly
    let effectiveTenantId = window.APP_CONFIG?.APP_TENANT_ID || localStorage.getItem('tenantId') || ''

    // Debug the tenant ID value - this is critical for debugging connection issues
    console.log('Using tenant ID for WebSocket connection:', effectiveTenantId || 'No tenant ID found')

    if (!effectiveTenantId) {
      console.error('NO TENANT ID FOUND - WebSocket connection will likely fail')
      console.error('Attempting to load tenant ID from other sources...')

      // Try to extract tenant ID from token if it's a JWT
      if (token && token.includes('.')) {
        try {
          const tokenParts = token.split('.')
          if (tokenParts.length === 3) {
            const payload = JSON.parse(atob(tokenParts[1]))
            if (payload && payload.tenantId) {
              console.log('Extracted tenant ID from JWT payload:', payload.tenantId)
              localStorage.setItem('tenantId', payload.tenantId)
              window.APP_CONFIG = window.APP_CONFIG || {}
              window.APP_CONFIG.APP_TENANT_ID = payload.tenantId
              // Update our variable to use the extracted tenant ID
              effectiveTenantId = payload.tenantId
            }
          }
        } catch (e) {
          console.error('Failed to extract tenant ID from token:', e)
        }
      }
    }

    // If tenant ID is not explicitly set, look for default tenant ID in the app config
    // Most OpenMeet installations use a default tenant ID when not specified
    if (!effectiveTenantId) {
      // If using OpenMeet's default multi-tenant setup, use the default tenant ID
      effectiveTenantId = 'default'
      console.warn('No tenant ID found, using fallback default tenant ID:', effectiveTenantId)
      localStorage.setItem('tenantId', effectiveTenantId)
      window.APP_CONFIG = window.APP_CONFIG || {}
      window.APP_CONFIG.APP_TENANT_ID = effectiveTenantId
    }

    // Only use x-tenant-id header, not query parameter
    // This avoids CORS issues with custom headers
    const socketOptions = {
      auth: {
        token: `Bearer ${token}`,
        tenantId: effectiveTenantId
      },
      extraHeaders: {
        'x-tenant-id': effectiveTenantId
      },
      reconnectionAttempts: 5,
      reconnectionDelay: 3000,
      timeout: 10000,
      transports: ['websocket', 'polling'] // Try WebSocket first
    }

    console.log('Creating Socket.IO connection with options:', JSON.stringify({
      endpoint,
      auth: {
        token: token ? 'Bearer <token>' : 'none',
        tenantId: effectiveTenantId || 'none'
      },
      headers: {
        'x-tenant-id': effectiveTenantId || 'none'
      }
    }))

    // Create socket.io connection with auth headers (JWT only)
    // Matrix credentials are now managed server-side
    const socket = io(endpoint, socketOptions)

    console.log('WebSocket connection created with JWT authentication')
    return socket
  },

  // Legacy method for backward compatibility - throw error to identify usage
  createEventSource: (): EventSource => {
    console.error('EventSource is no longer supported - please update your code to use WebSocket')
    throw new Error('EventSource is deprecated in favor of WebSockets for Matrix events')
  },

  // Get messages for a room with token checking
  getMessages: async (roomId: string, limit = 50, from?: string): Promise<AxiosResponse<{ messages: MatrixMessage[], end: string }>> => {
    try {
      // Ensure we have a valid Matrix token before making the request
      await matrixTokenService.getToken()
      return api.get(`/api/matrix/messages/${roomId}`, { params: { limit, from } })
    } catch (error) {
      console.error('Failed to get Matrix token for messages:', error)
      // Don't retry the same operation - just throw the error for caller to handle
      throw error
    }
  },

  // Send a message to a room with token checking
  sendMessage: async (roomId: string, message: string): Promise<AxiosResponse<{ id: string }>> => {
    try {
      // Ensure we have a valid Matrix token before making the request
      await matrixTokenService.getToken()
      return api.post(`/api/matrix/messages/${roomId}`, { message })
    } catch (error) {
      console.error('Failed to get Matrix token for sending message:', error)
      // Don't retry the same operation - just throw the error for caller to handle
      throw error
    }
  },

  // Get a fresh Matrix token (for direct Matrix operations)
  getToken: async (): Promise<string> => {
    return matrixTokenService.getToken()
  }
}
