import { computed, ComputedRef, unref } from 'vue'
import { getImageSrc } from '../utils/imageUtils'
import { UserEntity } from '../types'

export function useAvatarUrl (user: UserEntity | ComputedRef<UserEntity> | null | undefined) {
  const avatarUrl = computed(() => {
    const userValue = unref(user)
    if (!userValue) return getImageSrc(null)

    // Try Bluesky avatar first
    const blueskyPrefs = userValue.preferences?.bluesky
    if (blueskyPrefs?.avatar) {
      const avatarUrl = unref(blueskyPrefs.avatar)
      if (typeof avatarUrl === 'string') return getImageSrc(avatarUrl)
    }

    // Fallback to local photo
    const photoPath = unref(userValue.photo?.path)
    if (typeof photoPath === 'string') return getImageSrc(photoPath)

    // Finally fallback to placeholder
    return getImageSrc(null)
  })

  return { avatarUrl }
}
