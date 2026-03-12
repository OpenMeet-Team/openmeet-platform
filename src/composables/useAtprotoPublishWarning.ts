import { computed } from 'vue'
import { Notify } from 'quasar'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth-store'

export function useAtprotoPublishWarning () {
  const router = useRouter()
  const authStore = useAuthStore()

  const needsRelink = computed(() => {
    const identity = authStore.user?.atprotoIdentity
    if (!identity) return false
    return !identity.isCustodial && !identity.hasActiveSession
  })

  function warnIfNeeded () {
    if (!needsRelink.value) return

    Notify.create({
      type: 'warning',
      message: 'Saved! Your AT Protocol session has expired — visit your profile to reconnect.',
      position: 'top',
      timeout: 8000,
      actions: [
        {
          label: 'Go to Profile',
          color: 'white',
          handler: () => {
            router.push('/dashboard/profile')
          }
        }
      ]
    })
  }

  return {
    needsRelink,
    warnIfNeeded
  }
}
