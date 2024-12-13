import { route } from 'quasar/wrappers'
import { createMemoryHistory, createRouter, createWebHashHistory, createWebHistory } from 'vue-router'
import routes from './routes'
import { useAuthStore } from 'stores/auth-store.ts'

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

  Router.beforeEach((to, from, next) => {
    const authStore = useAuthStore()

    const authRoutes = ['AuthLoginPage', 'AuthRegisterPage', 'AuthForgotPasswordPage', 'AuthRestorePasswordPage']

    if (to.matched.some(record => record.meta.requiresAuth)) {
      if (!authStore.isAuthenticated) {
        next({ name: 'AuthLoginPage', query: { redirect: to.fullPath } })
      } else {
        next()
      }
    } else {
      if (authStore.isAuthenticated && authRoutes.includes(to.name as string)) {
        next({ name: 'HomePage' })
      } else {
        next()
      }
    }
  })

  return Router
})
