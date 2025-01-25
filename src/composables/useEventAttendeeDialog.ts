import { useQuasar } from 'quasar'
import EditAttendeeDialogComponent from '../components/event-attendees/EditAttendeeDialogComponent.vue'
import ViewAttendeeRequestDialogComponent from '../components/event-attendees/ViewAttendeeRequestDialogComponent.vue'
import { EventAttendeeEntity } from '../types'

export function useEventAttendeeDialog () {
  const $q = useQuasar()

  const openEditAttendeeDialog = (attendee: EventAttendeeEntity) => {
    return $q.dialog({
      component: EditAttendeeDialogComponent,
      componentProps: {
        attendee
      }
    })
  }

  const openDeleteAttendeeDialog = () => {
    return $q.dialog({
      title: 'Delete Attendee',
      message: 'Are you sure you want to delete this attendee?',
      cancel: true,
      persistent: true
    })
  }

  const openViewAttendeeRequestDialog = (attendee: EventAttendeeEntity) => {
    return $q.dialog({
      component: ViewAttendeeRequestDialogComponent,
      componentProps: {
        attendee
      }
    })
  }

  return {
    openEditAttendeeDialog,
    openDeleteAttendeeDialog,
    openViewAttendeeRequestDialog
  }
}
