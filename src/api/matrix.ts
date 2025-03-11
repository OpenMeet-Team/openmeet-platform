import { AxiosResponse } from 'axios'
import { api } from '../boot/axios'
import { MatrixMessage } from '../types/matrix'

export const matrixApi = {
  // Send typing indicator to a room
  sendTyping: (roomId: string, isTyping: boolean): Promise<AxiosResponse<void>> =>
    api.post(`/api/matrix/${roomId}/typing`, { isTyping }),

  // Create SSE connection for Matrix events
  createEventSource: (): EventSource => {
    // Use the API URL from the app config
    // This ensures we connect to the backend API, not the frontend webapp
    const apiBaseUrl = window.APP_CONFIG?.APP_API_URL || ''

    // Check for overridden API URL (ngrok or other proxy)
    const overrideUrl = window.__MATRIX_API_URL__ || ''

    // Use override if available, otherwise use the configured API URL
    let baseUrl = overrideUrl || apiBaseUrl

    // Log the API URL we're using
    console.log('Using API URL for Matrix connection:', baseUrl)
    
    // If we're in development and no baseUrl is configured, try localhost
    if (!baseUrl && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
      baseUrl = window.location.origin
      console.log('No API URL configured, defaulting to current origin for SSE:', baseUrl)
    }

    if (!baseUrl) {
      console.error('No API URL found. Make sure APP_API_URL is configured in config.json')
      throw new Error('Cannot connect to Matrix: API URL not configured')
    }

    // Found the endpoint in the controller code!
    // In the MatrixController, we have @Sse('events') which means the
    // endpoint is /api/matrix/events (matrix is the controller path)
    const endpoint = `${baseUrl}/api/matrix/events`
    console.log('Creating EventSource connection to Matrix at:', endpoint)

    // Log that we're attempting to establish an SSE connection
    console.log('Attempting to establish SSE connection for real-time Matrix events')
    
    // Set up an EventSource with needed parameters
    const tenantId = window.APP_CONFIG?.APP_TENANT_ID || ''
    
    // Append tenant ID as a query parameter since EventSource doesn't support custom headers
    // SSE should work with cookies for auth, so we don't need to explicitly pass the token
    
    const endpointWithParams = `${endpoint}?tenantId=${tenantId}`;
    console.log('Updated endpoint with params:', endpointWithParams)
    
    return new EventSource(endpointWithParams, { withCredentials: true })
  },

  // Get messages for a room
  getMessages: (roomId: string, limit = 50, from?: string): Promise<AxiosResponse<{ messages: MatrixMessage[], end: string }>> =>
    api.get(`/api/matrix/messages/${roomId}`, { params: { limit, from } }),

  // Send a message to a room
  sendMessage: (roomId: string, message: string): Promise<AxiosResponse<{ id: string }>> =>
    api.post(`/api/matrix/messages/${roomId}`, { message })
}
