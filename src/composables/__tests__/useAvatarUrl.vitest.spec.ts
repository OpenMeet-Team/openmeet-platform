import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useAvatarUrl } from '../useAvatarUrl'
import type { UserEntity } from '../../types'

describe('useAvatarUrl', () => {
  it('should return placeholder when user is null', () => {
    const { avatarUrl } = useAvatarUrl(null)
    // getImageSrc returns a data:image/svg+xml;base64 placeholder when given null
    expect(avatarUrl.value).toContain('data:image/svg+xml;base64')
  })

  it('should return placeholder when user is undefined', () => {
    const { avatarUrl } = useAvatarUrl(undefined)
    expect(avatarUrl.value).toContain('data:image/svg+xml;base64')
  })

  it('should return bluesky avatar when avatar is set (without connected flag)', () => {
    const user: UserEntity = {
      id: 1,
      ulid: 'test-ulid',
      slug: 'test-user',
      email: 'test@example.com',
      preferences: {
        bluesky: {
          avatar: 'https://cdn.bsky.social/avatar.jpg'
          // Note: no 'connected' property at all
        }
      }
    }
    const { avatarUrl } = useAvatarUrl(user)
    expect(avatarUrl.value).toBe('https://cdn.bsky.social/avatar.jpg')
  })

  it('should return bluesky avatar when connected is false but avatar exists', () => {
    // This is the key deprecation test: connected:false should NOT block avatar display
    const user: UserEntity = {
      id: 1,
      ulid: 'test-ulid',
      slug: 'test-user',
      email: 'test@example.com',
      preferences: {
        bluesky: {
          connected: false,
          avatar: 'https://cdn.bsky.social/avatar.jpg'
        }
      }
    }
    const { avatarUrl } = useAvatarUrl(user)
    expect(avatarUrl.value).toBe('https://cdn.bsky.social/avatar.jpg')
  })

  it('should return bluesky avatar when connected is true and avatar exists', () => {
    const user: UserEntity = {
      id: 1,
      ulid: 'test-ulid',
      slug: 'test-user',
      email: 'test@example.com',
      preferences: {
        bluesky: {
          connected: true,
          avatar: 'https://cdn.bsky.social/avatar.jpg'
        }
      }
    }
    const { avatarUrl } = useAvatarUrl(user)
    expect(avatarUrl.value).toBe('https://cdn.bsky.social/avatar.jpg')
  })

  it('should fall back to local photo when no bluesky avatar', () => {
    const user: UserEntity = {
      id: 1,
      ulid: 'test-ulid',
      slug: 'test-user',
      email: 'test@example.com',
      photo: { id: '1', path: '/uploads/photo.jpg' },
      preferences: {
        bluesky: {
          connected: true
          // no avatar
        }
      }
    }
    const { avatarUrl } = useAvatarUrl(user)
    expect(avatarUrl.value).toBe('/uploads/photo.jpg')
  })

  it('should fall back to placeholder when no bluesky avatar and no photo', () => {
    const user: UserEntity = {
      id: 1,
      ulid: 'test-ulid',
      slug: 'test-user',
      email: 'test@example.com'
    }
    const { avatarUrl } = useAvatarUrl(user)
    expect(avatarUrl.value).toContain('data:image/svg+xml;base64')
  })

  it('should work with a computed ref user', () => {
    const user = ref<UserEntity>({
      id: 1,
      ulid: 'test-ulid',
      slug: 'test-user',
      email: 'test@example.com',
      preferences: {
        bluesky: {
          avatar: 'https://cdn.bsky.social/avatar.jpg'
        }
      }
    })
    const { avatarUrl } = useAvatarUrl(user)
    expect(avatarUrl.value).toBe('https://cdn.bsky.social/avatar.jpg')
  })
})
