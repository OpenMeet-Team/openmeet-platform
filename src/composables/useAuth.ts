import { useRouter, useRoute } from 'vue-router'

export function useAuth () {
  const router = useRouter()
  const route = useRoute()

  const goToLogin = () => {
    router.push({
      name: 'AuthLoginPage',
      query: { redirect: route.fullPath }
    })
  }

  const goToRegister = () => {
    router.push({
      name: 'AuthRegisterPage',
      query: { redirect: route.fullPath }
    })
  }

  return {
    goToLogin,
    goToRegister
  }
}
