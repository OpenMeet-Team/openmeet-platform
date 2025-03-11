import { useAuthStore } from '../stores/auth-store'
import { authApi } from '../api/auth'
import { useNotification } from '../composables/useNotification'

/**
 * Ensures the current user has a Matrix user ID, attempting to provision one if missing
 * @returns true if user has or was assigned a Matrix user ID, false otherwise
 */
export const ensureMatrixUser = async (): Promise<boolean> => {
  const authStore = useAuthStore()

  // Check if user is already authenticated with Matrix
  if (authStore.user?.matrixUserId) {
    return true
  }

  try {
    // Request Matrix user provisioning from the backend
    const response = await authApi.provisionMatrixUser()

    if (response.data) {
      // Update the user record with Matrix credentials
      const updatedUser = {
        ...authStore.user,
        matrixUserId: response.data.matrixUserId,
        matrixAccessToken: response.data.matrixAccessToken,
        matrixDeviceId: response.data.matrixDeviceId
      }

      // Update the auth store with the new user data
      authStore.actionSetUser(updatedUser)
      return true
    }

    return false
  } catch (err) {
    console.error('Failed to provision Matrix user:', err)
    // Don't use notification in tests to avoid Quasar dependency issues
    if (process.env.NODE_ENV !== 'test') {
      const { error } = useNotification()
      error('Failed to set up chat account. Please try again later.')
    }
    return false
  }
}

/**
 * Extracts a display name from a Matrix user ID
 * @param matrixUserId The Matrix user ID (e.g., @username:domain.com)
 * @returns The extracted username or the original ID if extraction fails
 */
export const getMatrixDisplayName = (matrixUserId: string): string => {
  if (!matrixUserId) return 'Unknown User'

  const match = matrixUserId.match(/@([^:]+)/)
  return match ? match[1] : matrixUserId
}
