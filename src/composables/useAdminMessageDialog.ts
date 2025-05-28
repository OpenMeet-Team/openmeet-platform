import { useQuasar } from 'quasar'
import AdminMessageDialogComponent from '../components/group/AdminMessageDialogComponent.vue'
import { GroupEntity } from '../types'

export function useAdminMessageDialog () {
  const $q = useQuasar()

  const openAdminMessageDialog = (group: GroupEntity) => {
    return $q.dialog({
      component: AdminMessageDialogComponent,
      componentProps: {
        group
      }
    })
  }

  return {
    openAdminMessageDialog
  }
}
