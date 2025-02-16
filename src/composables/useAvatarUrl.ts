import { computed, ComputedRef, unref } from 'vue'
import { getImageSrc } from '../utils/imageUtils'
import { UserEntity } from '../types'

export function useAvatarUrl (user: UserEntity | ComputedRef<UserEntity> | null | undefined) {
  const avatarUrl = computed(() => {
    const userValue = unref(user)
    console.log('user', userValue)

    // try Bluesky avatar
    if (userValue?.preferences?.bluesky?.avatar) {
      console.log('user.preferences.bluesky.avatar', userValue.preferences.bluesky.avatar)
      return userValue.preferences.bluesky.avatar
    }

    // try local photo
    if (userValue?.photo?.path && typeof userValue.photo.path === 'string') {
      console.log('user.photo.path', userValue.photo.path)
      return getImageSrc(userValue.photo.path)
    }

    // Finally fallback to placeholder
    return getImageSrc(null)
  })

  return {
    avatarUrl
  }
}
