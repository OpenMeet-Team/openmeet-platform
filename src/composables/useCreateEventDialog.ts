import { useQuasar } from 'quasar'
import EventFormDialogComponent from 'src/components/event/EventFormDialogComponent.vue'

export function useCreateEventDialog () {
  const $q = useQuasar()

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

  return {
    openCreateEventDialog
  }
}
