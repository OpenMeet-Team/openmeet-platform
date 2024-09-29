import { useQuasar } from 'quasar'
import LoginDialogComponent from 'components/auth/LoginDialogComponent.vue'
import RegisterDialogComponent from 'components/auth/RegisterDialogComponent.vue'

export function useAuthDialog () {
  const $q = useQuasar()

  const openLoginDialog = () => {
    $q.dialog({
      component: LoginDialogComponent,
      componentProps: {
        onSubmit: (loginData: never) => {
          console.log('Logged in:', loginData)
        }
      }
    })
  }
  const openRegisterDialog = () => {
    $q.dialog({
      component: RegisterDialogComponent,
      componentProps: {
        onSubmit: (loginData: never) => {
          console.log('Register in:', loginData)
        }
      }
    })
  }

  return {
    openLoginDialog,
    openRegisterDialog
  }
}
