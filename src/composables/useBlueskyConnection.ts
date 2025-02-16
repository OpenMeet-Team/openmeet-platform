import { ref, computed } from 'vue'
import { useAuthStore } from '../stores/auth-store'
import { useAuthSession } from '../boot/auth-session'
import { blueskyApi } from '../api/bluesky'
import { authApi } from '../api/auth'
import { useNotification } from './useNotification'
import { UserEntity } from '../types/user'

export const useBlueskyConnection = () => {
  const authStore = useAuthStore()
  const user = computed(() => authStore.user as UserEntity)
  const authSession = useAuthSession()
  const { error, success } = useNotification()
  const isLoading = ref(false)

  const isConnected = computed(() => {
    return !!user.value?.preferences?.bluesky?.connected
  })

  const handle = computed(() => {
    return user.value?.preferences?.bluesky?.handle
  })

  const toggleConnection = async (enabled: boolean) => {
    isLoading.value = true
    try {
      // Verify auth session first
      const isAuthenticated = await authSession.checkAuthStatus()
      if (!isAuthenticated) {
        error('Please log in to manage Bluesky connection')
        return false
      }

      if (enabled) {
        const result = await blueskyApi.connect()
        success(result.data.message)
      } else {
        const result = await blueskyApi.disconnect()
        success(result.data.message)
      }

      // Refresh user data to sync the updated connection state
      const userResponse = await authApi.getMe()
      if (userResponse.data) {
        authStore.actionSetUser(userResponse.data)
      }

      return true
    } catch (err) {
      console.error('Failed to toggle Bluesky connection:', err)
      error('Failed to update Bluesky connection')
      return false
    } finally {
      isLoading.value = false
    }
  }

  return {
    isLoading,
    isConnected,
    handle,
    toggleConnection
  }
}
