<script setup lang="ts">

import ShareComponent from 'components/common/ShareComponent.vue'
import { EventAttendeeEntity, EventAttendeeStatus, EventEntity } from 'src/types'
import { formatDate } from '../../utils/dateUtils.ts'
import { Dark } from 'quasar'
import { useAuthStore } from 'stores/auth-store.ts'
import { useEventStore } from 'stores/event-store.ts'
import { useAuthDialog } from 'src/composables/useAuthDialog.ts'
import { useEventDialog } from 'src/composables/useEventDialog.ts'
import { useNotification } from 'src/composables/useNotification.ts'
import QRCodeComponent from '../common/QRCodeComponent.vue'

interface Props {
  event: EventEntity
}

const { success } = useNotification()
const props = defineProps<Props>()
const { openAttendEventDialog, openCancelAttendingEventDialog, openEventAttendPendingDialog, openEventAttendWaitlistDialog, openEventAttendRejectedDialog } = useEventDialog()
const { openLoginDialog } = useAuthDialog()

const onAttendClick = () => {
  if (useAuthStore().isAuthenticated) {
    openAttendEventDialog(props.event).onOk(({ approvalAnswer }) => {
      useEventStore().actionAttendEvent(props.event.slug, {
        approvalAnswer
      } as Partial<EventAttendeeEntity>).then(attendee => {
        if (attendee) {
          if (attendee.status === EventAttendeeStatus.Pending) {
            openEventAttendPendingDialog()
          } else if (attendee.status === EventAttendeeStatus.Confirmed) {
            success('You are now attending this event!')
          } else if (attendee.status === EventAttendeeStatus.Waitlist) {
            openEventAttendWaitlistDialog()
          } else if (attendee.status === EventAttendeeStatus.Rejected) {
            openEventAttendRejectedDialog()
          }
        }
      })
    })
  } else {
    openLoginDialog()
  }
}

const onEditAttendenceClick = () => {
  openCancelAttendingEventDialog().onOk(() => {
    if (props.event.attendee) {
      useEventStore().actionCancelAttending(props.event).then(() => {
        success('Event attendance cancelled!')
      })
    }
  })
}
</script>

<template>
  <q-page-sticky v-if="event" expand position="bottom" :class="[Dark.isActive ? 'bg-dark' : 'bg-grey-2']">
    <div class="col row q-py-md q-mx-auto" style="max-width: 1201px">
      <div class="col col-12 col-md-8 q-px-md min-width-200">
        <div class="text-body2 text-bold">{{ formatDate(event.startDate) }}</div>
        <div class="text-h6 text-bold">{{ event.name }}</div>
      </div>
      <div class="col col-12 col-md-4 row q-gutter-md justify-end no-wrap">
        <div class="column" v-if="useEventStore().getterUserIsAttendee()">
          <div class="text-subtitle1 text-bold" v-if="event.attendee?.status === EventAttendeeStatus.Confirmed">You're going!</div>
          <div class="text-subtitle1 text-bold" v-if="event.attendee?.status === EventAttendeeStatus.Pending">You're pending!</div>
          <div class="text-subtitle1 text-bold" v-if="event.attendee?.status === EventAttendeeStatus.Waitlist">You're on the waitlist!</div>
          <div class="text-subtitle1 text-bold" v-if="event.attendee?.status === EventAttendeeStatus.Rejected">You're rejected!</div>
          <div class="text-subtitle1 text-bold" v-if="event.attendee?.status === EventAttendeeStatus.Cancelled">You're cancelled!</div>
          <div><q-btn data-cy="event-edit-attendance-button" @click="onEditAttendenceClick" no-caps size="md"
              padding="none" flat color="primary" label="Edit RSVP" /></div>
        </div>
        <div class="row items-start q-gutter-md">
          <ShareComponent class="col-4" />
          <q-btn class="col-3" data-cy="event-attend-button" v-if="!useEventStore().getterUserIsAttendee()" no-caps
            label="Attend" color="primary" @click="onAttendClick" />

          <QRCodeComponent class="" />
        </div>

      </div>
    </div>
  </q-page-sticky>
</template>

<style scoped lang="scss"></style>
