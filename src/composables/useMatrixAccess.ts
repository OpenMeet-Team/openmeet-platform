import { ref } from 'vue'
import { useNotification } from './useNotification'
import { matrixApi } from '../api/matrix'
import { useAuthStore } from '../stores/auth-store'

interface MatrixApiError extends Error {
  response?: {
    data?: {
      message?: string;
    };
  };
}

export function useMatrixAccess () {
  const isSettingPassword = ref(false)
  const { success, error } = useNotification()
  const authStore = useAuthStore()

  /**
   * Set a Matrix password for direct client access
   *
   * @param password The new password to set
   * @returns Promise<boolean> True if successful, false otherwise
   */
  const setMatrixPassword = async (password: string): Promise<boolean> => {
    if (!password || password.length < 8) {
      error('Password must be at least 8 characters long')
      return false
    }

    try {
      isSettingPassword.value = true
      const response = await matrixApi.setPassword(password)

      if (response.data.success) {
        // Success message
        success(response.data.message || 'Matrix password set successfully')

        // Update user preferences to reflect that they have direct access
        const userData = authStore.user
        if (userData) {
          const updatedUser = {
            ...userData,
            preferences: {
              ...userData.preferences,
              matrix: {
                ...userData.preferences?.matrix,
                hasDirectAccess: true,
                lastPasswordChanged: new Date()
              }
            }
          }
          // Update the user in the store
          authStore.actionSetUser(updatedUser)
        }

        return true
      } else {
        error(response.data.message || 'Failed to set Matrix password')
        return false
      }
    } catch (err: unknown) {
      const errorObj = err as MatrixApiError
      const errorMessage = errorObj.response?.data?.message || errorObj.message || 'Failed to set Matrix password'
      error(errorMessage)
      console.error('Error setting Matrix password:', err)
      return false
    } finally {
      isSettingPassword.value = false
    }
  }

  /**
   * Check if the user has Matrix credentials
   */
  const hasMatrixAccount = (): boolean => {
    const userData = authStore.user
    if (!userData?.id) {
      return false
    }

    // Check if user has legacy matrix user ID
    if (userData.matrixUserId) {
      return true
    }

    // Check if user has matrix preferences indicating they have an account
    if (userData.preferences?.matrix?.hasDirectAccess) {
      return true
    }

    // For now, we assume users do have matrix accounts
    // TODO: Add API endpoint to check matrix handle registry
    return true
  }

  /**
   * Check if the user has set up direct Matrix access
   */
  const hasDirectAccess = (): boolean => {
    const userData = authStore.user
    return !!userData?.preferences?.matrix?.hasDirectAccess
  }

  /**
   * Get the user's Matrix ID for display
   */
  const getMatrixUserId = (): string | null => {
    const userData = authStore.user
    return userData?.matrixUserId || null
  }

  return {
    isSettingPassword,
    setMatrixPassword,
    hasMatrixAccount,
    hasDirectAccess,
    getMatrixUserId
  }
}
