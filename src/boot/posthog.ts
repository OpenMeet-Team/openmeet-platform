import { PostHog } from 'posthog-js'
import { Router } from 'vue-router'

let posthog: PostHog

export default ({ router }: { router: Router }) => {
  // Initialize PostHog asynchronously without blocking
  initPostHogWhenReady(router)
  return router
}

async function initPostHogWhenReady (router: Router) {
  try {
    // Check if config is already available
    if (window.APP_CONFIG?.APP_POSTHOG_KEY) {
      await initPostHog(window.APP_CONFIG.APP_POSTHOG_KEY, router)
      return
    }

    // If not, wait for DOMContentLoaded
    const onLoad = () => {
      if (window.APP_CONFIG?.APP_POSTHOG_KEY) {
        initPostHog(window.APP_CONFIG.APP_POSTHOG_KEY, router)
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
  const module = await import('posthog-js')
  posthog = module.default
  posthog.init(key, {
    api_host: 'https://us.i.posthog.com',
    person_profiles: 'always',
    cross_subdomain_cookie: !!window.APP_CONFIG?.APP_POSTHOG_COOKIE_DOMAIN,
    opt_out_capturing_persistence_type: 'cookie',
    // cookie_domain is a valid PostHog option but missing from the TS types
    ...(window.APP_CONFIG?.APP_POSTHOG_COOKIE_DOMAIN
      ? { cookie_domain: window.APP_CONFIG.APP_POSTHOG_COOKIE_DOMAIN }
      : {})
  } as Parameters<typeof posthog.init>[1])

  router.afterEach((to) => {
    if (!to.path.includes('/auth/bluesky/callback')) {
      posthog?.capture('$pageview', { path: to.path })
    }
  })
}

export { posthog }
