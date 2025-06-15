import { useQuasar } from 'quasar'
import { EventEntity, EventStatus, GroupEntity } from '../types'
import { useNotification } from '../composables/useNotification'
import EventAttendDialogComponent from '../components/event/EventAttendDialogComponent.vue'
import { eventsApi } from '../api/events'
import EventAttendWaitlistDialogComponent from '../components/event/dialogs/EventAttendWaitlistDialogComponent.vue'
import EventAttendPendingDialogComponent from '../components/event/dialogs/EventAttendPendingDialogComponent.vue'
import EventAttendRejectedDialogComponent from '../components/event/dialogs/EventAttendRejectedDialogComponent.vue'
import EventAttendeesNoRightsDialogComponent from '../components/event/dialogs/EventAttendeesNoRightsDialogComponent.vue'
import { useRouter } from 'vue-router'
import { useEventStore } from '../stores/event-store'

export function useEventDialog () {
  const $q = useQuasar()
  const { success } = useNotification()
  const router = useRouter()
  const eventStore = useEventStore()

  const openDeleteGroupDialog = () => {
    return $q.dialog({
      title: 'Delete Group',
      message: 'Are you sure you want to delete this group? This action cannot be undone.',
      cancel: true,
      persistent: true
    })
  }

  const goToCreateEvent = (group?: GroupEntity, initialDate?: string) => {
    // Navigate to dedicated event creation page instead of opening dialog
    const query: Record<string, string> = {
      redirect: router.currentRoute.value.fullPath
    }

    if (group?.slug) {
      query.groupSlug = group.slug
    }

    if (initialDate) {
      query.date = initialDate
    }

    router.push({
      name: 'CreateEventPage',
      query
    })
  }

  const openAttendEventDialog = (event: EventEntity) => {
    return $q.dialog({
      component: EventAttendDialogComponent,
      componentProps: { event }
    })
  }

  const openCancelAttendingEventDialog = () => {
    return $q.dialog({
      title: 'Cancel Attendance',
      message: 'Are you sure you want to cancel your attendance for this event?',
      persistent: true,
      ok: {
        label: 'Yes',
        color: 'negative'
      },
      cancel: {
        label: 'No'
      }
    })
  }

  const openEventAttendPendingDialog = () => {
    return $q.dialog({
      component: EventAttendPendingDialogComponent
    })
  }

  const openEventAttendWaitlistDialog = () => {
    return $q.dialog({
      component: EventAttendWaitlistDialogComponent
    })
  }

  const openEventAttendRejectedDialog = () => {
    return $q.dialog({
      component: EventAttendRejectedDialogComponent
    })
  }

  const openDeleteEventDialog = (event: EventEntity) => {
    $q.dialog({
      title: 'Delete Event',
      message: `Are you sure you want to delete the event '${event.name}'? This action cannot be undone.`,
      cancel: true,
      persistent: true
    }).onOk(() => {
      return eventsApi.delete(event.slug).then(() => {
        success('Event deleted!')
        // Redirect to events page after successful deletion
        router.push({ name: 'HomePage' })
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
      return eventsApi.update(event.slug, { status: EventStatus.Cancelled } as Partial<EventEntity>).then(() => {
        success('Event cancelled!')
        // Refresh the event data to update the UI with the cancelled status
        eventStore.actionGetEventBySlug(event.slug)
      })
    })
  }

  const openNoAttendeesRightsDialog = () => {
    return $q.dialog({
      component: EventAttendeesNoRightsDialogComponent
    })
  }

  return {
    goToCreateEvent,
    openDeleteEventDialog,
    openCancelEventDialog,
    openAttendEventDialog,
    openCancelAttendingEventDialog,
    openDeleteGroupDialog,
    openEventAttendPendingDialog,
    openEventAttendWaitlistDialog,
    openEventAttendRejectedDialog,
    openNoAttendeesRightsDialog
  }
}
