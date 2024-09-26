import { useQuasar } from 'quasar'
import LoginDialogComponent from 'components/auth/LoginDialogComponent.vue'

export function useLoginDialog () {
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

  return {
    openLoginDialog
  }
}
