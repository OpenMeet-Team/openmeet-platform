import { useAuthStore } from '../stores/auth-store'
import { Router } from 'vue-router'
import posthog from 'posthog-js'

export default async ({ router }: { router: Router }) => {
  const POSTHOG_KEY = process.env.APP_POSTHOG_KEY

  if (typeof window === 'undefined') {
    // Exit if not running in a browser environment
    return
  }

  if (!POSTHOG_KEY) {
    console.warn('PostHog key not found in config after timeout. Analytics will be disabled.')
    return
  }

  posthog.init(POSTHOG_KEY, {
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
    posthog.capture('$pageview', { path: to.path })
  })
}

export { posthog }
