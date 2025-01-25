import { route } from 'quasar/wrappers'
import { createMemoryHistory, createRouter, createWebHashHistory, createWebHistory } from 'vue-router'
import routes from './routes'
import { useAuthStore } from '../stores/auth-store'

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
    console.log('router beforeEach', from.name, to.name)
    // console.trace()

    const authStore = useAuthStore()

    const authRoutes = ['AuthLoginPage', 'AuthRegisterPage', 'AuthForgotPasswordPage', 'AuthRestorePasswordPage']

    if (to.matched.some(record => record.meta.requiresAuth)) {
      console.log('router requiresAuth')
      if (!authStore.isAuthenticated) {
        console.log('router beforeEach redirect to AuthLoginPage', to.fullPath)
        next({ name: 'AuthLoginPage', query: { redirect: to.fullPath } })
      } else {
        console.log('router next')
        next()
      }
    } else {
      console.log('router requiresAuth false')
      if (authStore.isAuthenticated && authRoutes.includes(to.name as string)) {
        console.log('router beforeEach redirect to HomePage', to.fullPath)
        next({ name: 'HomePage' })
      } else {
        console.log('router next')
        next()
      }
    }
  })

  return Router
})
