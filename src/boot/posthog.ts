import { useAuthStore } from '../stores/auth-store'
import { Router } from 'vue-router'
import posthog from 'posthog-js'

const POSTHOG_KEY = process.env.APP_POSTHOG_KEY

export default async ({ router }: { router: Router }) => {
  if (typeof window === 'undefined') {
    // Exit if not running in a browser environment
    return
  }

  if (!POSTHOG_KEY) {
    console.warn('PostHog key not found in config after timeout. Analytics will be disabled.')
    return
  }

  initPostHogWhenReady(router)
  return router
}

async function initPostHogWhenReady (router: Router) {
  try {
    // Check if config is already available
    if (POSTHOG_KEY) {
      await initPostHog(POSTHOG_KEY, router)
      return
    }

    // If not, wait for DOMContentLoaded
    const onLoad = () => {
      if (POSTHOG_KEY) {
        initPostHog(POSTHOG_KEY, router)
      } else {
        console.warn('PostHog key not found. Analytics disabled.')
      }
      document.removeEventListener('DOMContentLoaded', onLoad)
    }

    document.addEventListener('DOMContentLoaded', onLoad)
  } catch (error) {
    console.warn('Failed to initialize PostHog:', error)
  }
}

async function initPostHog (key: string, router: Router) {
  posthog.init(key, {
    debug: false,
    api_host: 'https://us.i.posthog.com',
    person_profiles: 'identified_only'
  })
  posthog.group('tenant_id', process.env.APP_TENANT_ID as string)

  const authStore = useAuthStore()
  if (authStore.getUser) {
    posthog.identify(authStore.getUser.shortId, {
      email: authStore.getUser.email,
      name: authStore.getUser.name
    })
  }

  router.afterEach((to) => {
    if (!to.path.includes('/auth/bluesky/callback')) {
      posthog?.capture('$pageview', { path: to.path })
    }
  })
}

export { posthog }
