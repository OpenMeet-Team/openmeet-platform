import { PostHog } from 'posthog-js'
import { useAuthStore } from 'src/stores/auth-store'
import { Router } from 'vue-router'

let posthog: PostHog

export default async ({ router }: { router: Router }) => {
  // Wait for config with timeout
  let attempts = 0
  const maxAttempts = 20 // 1 second total (20 * 50ms)

  while (!window.APP_CONFIG?.APP_POSTHOG_KEY && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 50))
    attempts++
  }

  const POSTHOG_KEY = window.APP_CONFIG?.APP_POSTHOG_KEY

  if (!POSTHOG_KEY) {
    console.warn('PostHog key not found in config after timeout. Analytics will be disabled.')
    return
  }

  const module = await import('posthog-js')
  posthog = module.default
  posthog.init(POSTHOG_KEY, {
    debug: false,
    api_host: 'https://us.i.posthog.com',
    person_profiles: 'identified_only'
  })
  posthog.group('tenant_id', window.APP_CONFIG?.APP_TENANT_ID as string)

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
