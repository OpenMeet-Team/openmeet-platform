import { useQuasar } from 'quasar'
import EventFormDialogComponent from 'src/components/event/EventFormDialogComponent.vue'
import { EventEntity, GroupEntity, GroupStatus } from 'src/types'
import { groupsApi } from 'src/api/groups.ts'
import { useNotification } from 'src/composables/useNotification.ts'
import EventAttendDialogComponent from 'components/event/EventAttendDialogComponent.vue'

export function useEventDialog () {
  const $q = useQuasar()
  const { success } = useNotification()

  const openDeleteGroupDialog = () => {
    return $q.dialog({
      title: 'Delete Group',
      message: 'Are you sure you want to delete this group? This action cannot be undone.',
      cancel: true,
      persistent: true
    })
  }

  const openCreateEventDialog = (group?: GroupEntity) => {
    return $q.dialog({
      component: EventFormDialogComponent,
      componentProps: { group }
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
      title: 'Attendance Pending',
      message: 'Your attendance is pending approval. Please wait for the event organizer to approve your attendance.',
      persistent: true
    })
  }

  const openEventAttendWaitlistDialog = () => {
    return $q.dialog({
      title: 'Waitlist',
      message: 'The waitlist is full. Please wait for the event organizer to approve your attendance.',
      persistent: true
    })
  }

  const openEventAttendRejectedDialog = () => {
    return $q.dialog({
      title: 'Rejected',
      message: 'You have been rejected from this event.',
      persistent: true
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
      return groupsApi.update(event.id, { status: GroupStatus.Draft }).then(() => {
        success('Event cancelled!')
      })
    })
  }

  return {
    openCreateEventDialog,
    openDeleteEventDialog,
    openCancelEventDialog,
    openAttendEventDialog,
    openCancelAttendingEventDialog,
    openDeleteGroupDialog,
    openEventAttendPendingDialog,
    openEventAttendWaitlistDialog,
    openEventAttendRejectedDialog
  }
}
