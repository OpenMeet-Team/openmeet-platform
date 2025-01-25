import { useQuasar } from 'quasar'
import LoginDialogComponent from '../components/auth/LoginDialogComponent.vue'
import RegisterDialogComponent from '../components/auth/RegisterDialogComponent.vue'

export function useAuthDialog () {
  const $q = useQuasar()

  const openLoginDialog = () => {
    $q.dialog({
      component: LoginDialogComponent
    })
  }
  const openRegisterDialog = () => {
    $q.dialog({
      component: RegisterDialogComponent
    })
  }

  return {
    openLoginDialog,
    openRegisterDialog
  }
}
