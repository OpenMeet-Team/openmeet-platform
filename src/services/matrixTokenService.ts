import { api } from '../boot/axios'
import { useAuthStore } from '../stores/auth-store'
import { ref, readonly } from 'vue'

// Create reactive state for token refresh status
const isRefreshing = ref(false)
const refreshPromise = ref<Promise<string> | null>(null)
const matrixToken = ref<string | null>(null)
const matrixTokenExpires = ref<number | null>(null)

// Default expiration time: 1 hour (in milliseconds)
const DEFAULT_EXPIRATION = 60 * 60 * 1000

/**
 * Service to manage Matrix tokens with proper refresh handling
 */
class MatrixTokenService {
  /**
   * Get the current Matrix token, refreshing if necessary
   * @returns A promise that resolves to the valid Matrix token
   */
  async getToken (): Promise<string> {
    // Check if we have a token and it's not expired
    const now = Date.now()
    const threshold = 5 * 60 * 1000 // 5 minutes before expiry

    if (matrixToken.value && matrixTokenExpires.value &&
        now + threshold < matrixTokenExpires.value) {
      console.log('Using existing Matrix token')
      return matrixToken.value
    }

    // If token is expired or will expire soon, refresh it
    return this.refreshToken()
  }

  /**
   * Refresh the Matrix token
   * @returns A promise that resolves to the new Matrix token
   */
  async refreshToken (): Promise<string> {
    // If already refreshing, return the existing promise
    if (isRefreshing.value && refreshPromise.value) {
      console.log('Matrix token refresh already in progress, reusing promise')
      return refreshPromise.value
    }

    isRefreshing.value = true
    console.log('Refreshing Matrix token')

    refreshPromise.value = new Promise<string>((resolve, reject) => {
      // Use a regular function instead of async
      const doRefresh = () => {
        const authStore = useAuthStore()

        // Ensure user authentication is valid before requesting Matrix token
        if (!authStore.isAuthenticated) {
          return Promise.reject(new Error('User is not authenticated'))
        }

        // Call the backend to get a fresh Matrix token
        return api.post('/api/matrix/token')
          .then(response => {
            if (!response.data || !response.data.accessToken) {
              throw new Error('No Matrix token received from server')
            }

            // Store the new token and expiration
            matrixToken.value = response.data.accessToken

            // Set expiration either from response or default (1 hour)
            const expiresIn = response.data.expiresIn || DEFAULT_EXPIRATION
            matrixTokenExpires.value = Date.now() + expiresIn

            console.log('Matrix token refreshed successfully')
            return matrixToken.value
          })
      }

      // Execute the refresh and handle the promise results
      doRefresh()
        .then(resolve)
        .catch(err => {
          console.error('Failed to refresh Matrix token:', err)
          // Clear the stored token on error
          matrixToken.value = null
          matrixTokenExpires.value = null
          reject(err)
        })
        .finally(() => {
          isRefreshing.value = false
          refreshPromise.value = null
        })
    })

    return refreshPromise.value
  }

  /**
   * Clear the stored Matrix token
   */
  clearToken (): void {
    matrixToken.value = null
    matrixTokenExpires.value = null
    console.log('Matrix token cleared')
  }

  /**
   * Check if we have a valid Matrix token
   */
  hasValidToken (): boolean {
    const now = Date.now()
    return !!matrixToken.value && !!matrixTokenExpires.value && now < matrixTokenExpires.value
  }

  /**
   * Get token status information (for debugging)
   */
  getTokenStatus () {
    return {
      hasToken: !!matrixToken.value,
      expiresIn: matrixTokenExpires.value
        ? Math.floor((matrixTokenExpires.value - Date.now()) / 1000)
        : null,
      isRefreshing: isRefreshing.value
    }
  }
}

// Create singleton instance
const matrixTokenService = new MatrixTokenService()

// Export the service instance
export default matrixTokenService

// Export reactive properties for composables
export const useMatrixToken = () => {
  return {
    isRefreshing: readonly(isRefreshing),
    hasValidToken: matrixTokenService.hasValidToken.bind(matrixTokenService),
    getTokenStatus: matrixTokenService.getTokenStatus.bind(matrixTokenService),
    getToken: matrixTokenService.getToken.bind(matrixTokenService),
    refreshToken: matrixTokenService.refreshToken.bind(matrixTokenService),
    clearToken: matrixTokenService.clearToken.bind(matrixTokenService)
  }
}
