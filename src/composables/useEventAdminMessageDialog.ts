import { useQuasar } from 'quasar'
import EventAdminMessageDialogComponent from '../components/event/EventAdminMessageDialogComponent.vue'
import { EventEntity } from '../types'

export function useEventAdminMessageDialog () {
  const $q = useQuasar()

  const openEventAdminMessageDialog = (event: EventEntity) => {
    return $q.dialog({
      component: EventAdminMessageDialogComponent,
      componentProps: {
        event
      }
    })
  }

  return {
    openEventAdminMessageDialog
  }
}
