import { route } from 'quasar/wrappers'
import { createMemoryHistory, createRouter, createWebHashHistory, createWebHistory } from 'vue-router'
import routes from './routes'
import { useAuthStore } from '../stores/auth-store'
import { versionService } from '../services/versionService'
import { matrixClientManager } from '../services/MatrixClientManager'
import type { RouteLocationNormalized } from 'vue-router'

/**
 * Extract Matrix context from route for cleanup purposes
 * Context includes entity type, slug, and tenant ID for Matrix room management
 */
function extractMatrixContext (route: RouteLocationNormalized): string {
  const tenantId = localStorage.getItem('tenantId') || 'default'

  // Extract entity type and slug from route
  if (route.name?.toString().includes('Group')) {
    const groupSlug = route.params?.slug
    return groupSlug ? `group-${groupSlug}-${tenantId}` : `group-unknown-${tenantId}`
  }

  if (route.name?.toString().includes('Event')) {
    const eventSlug = route.params?.slug
    return eventSlug ? `event-${eventSlug}-${tenantId}` : `event-unknown-${tenantId}`
  }

  // For other routes, use a generic context with tenant
  return `general-${String(route.name) || 'unknown'}-${tenantId}`
}

/*
 * If not building with SSR mode, you can
 * directly export the Router instantiation;
 *
 * The function below can be async too; either use
 * async/await or return a Promise which resolves
 * with the Router instance.
 */

export default route(function (/* { store, ssrContext } */) {
  const createHistory = process.env.SERVER
    ? createMemoryHistory
    : (process.env.VUE_ROUTER_MODE === 'history' ? createWebHistory : createWebHashHistory)

  const Router = createRouter({
    // scrollBehavior: () => ({ left: 0, top: 0 }),
    scrollBehavior (to, from, savedPosition) {
      if (to.path.startsWith('/groups/') && from.path.startsWith('/groups/')) {
        return false
      }

      // For other routes, restore position or go to top
      return savedPosition || { top: 0 }
    },
    routes,

    // Leave this as is and make changes in quasar.conf.js instead!
    // quasar.conf.js -> build -> vueRouterMode
    // quasar.conf.js -> build -> publicPath
    history: createHistory(process.env.VUE_ROUTER_BASE)
  })

  Router.beforeEach(async (to, from, next) => {
    const authStore = useAuthStore()

    const authRoutes = ['AuthLoginPage', 'AuthRegisterPage', 'AuthForgotPasswordPage', 'AuthRestorePasswordPage']

    // Check for admin routes and prevent access for non-admin users
    if (to.path.startsWith('/admin')) {
      if (!authStore.isAuthenticated) {
        next({ name: 'AuthLoginPage', query: { redirect: to.fullPath } })
        return
      }

      // Import UserRole to check admin access
      const { UserRole } = await import('../types')
      if (!authStore.hasRole(UserRole.Admin)) {
        next({ name: 'HomePage' })
        return
      }
    }

    if (to.matched.some(record => record.meta.requiresAuth)) {
      if (!authStore.isAuthenticated) {
        next({ name: 'AuthLoginPage', query: { redirect: to.fullPath } })
      } else {
        next()
      }
    } else {
      if (authStore.isAuthenticated && authRoutes.includes(to.name as string)) {
        // Allow OIDC flows even when authenticated
        if (to.query.oidc_flow === 'true') {
          next()
        } else {
          next({ name: 'HomePage' })
        }
      } else {
        next()
      }
    }

    if (from.name && from.name !== to.name) {
      try {
        await versionService.checkForUpdates()
      } catch (error) {
        console.warn('Version check failed during navigation:', error)
      }

      // Clean up Matrix client state when switching contexts
      try {
        const oldContext = extractMatrixContext(from)
        const newContext = extractMatrixContext(to)

        if (oldContext !== newContext) {
          await matrixClientManager.cleanupOnNavigation(newContext, oldContext)
        }
      } catch (error) {
        console.warn('Matrix cleanup failed during navigation:', error)
      }
    }
  })

  return Router
})
