import { useQuasar } from 'quasar'
import EventFormDialogComponent from 'src/components/event/EventFormDialogComponent.vue'
import { EventEntity } from 'src/types'
import { groupsApi } from 'src/api/groups.ts'
import { useNotification } from 'src/composables/useNotification.ts'

export function useEventDialog () {
  const $q = useQuasar()
  const { success } = useNotification()

  const openCreateEventDialog = () => {
    $q.dialog({
      component: EventFormDialogComponent,
      componentProps: {
        onSubmit: (formData: never) => {
          // Here you can handle the form submission
          console.log('Event created:', formData)
          // You might want to update your app state or make an API call here
        }
      }
    })
  }

  const openDeleteEventDialog = (event: EventEntity) => {
    $q.dialog({
      title: 'Delete Event',
      message: `Are you sure you want to delete the event '${event.name}'? This action cannot be undone.`,
      cancel: true,
      persistent: true
    }).onOk(() => {
      return groupsApi.delete(event.id).then(() => {
        success('Event deleted!')
      })
    })
  }

  const openCancelEventDialog = (event: EventEntity) => {
    $q.dialog({
      title: 'Cancel Event',
      message: `Are you sure you want to cancel the event '${event.name}'? You can publish it later with updated information`,
      cancel: true,
      persistent: true
    }).onOk(() => {
      return groupsApi.update(event.id, { status: 'draft' }).then(() => {
        success('Event cancelled!')
      })
    })
  }

  return {
    openCreateEventDialog,
    openDeleteEventDialog,
    openCancelEventDialog
  }
}
