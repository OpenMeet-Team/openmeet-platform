<script setup lang="ts">

import ShareComponent from 'components/common/ShareComponent.vue'
import { EventAttendeeEntity, EventEntity } from 'src/types'
import { formatDate } from '../../utils/dateUtils.ts'
import { Dark } from 'quasar'
import { useAuthStore } from 'stores/auth-store.ts'
import { useEventStore } from 'stores/event-store.ts'
import { useAuthDialog } from 'src/composables/useAuthDialog.ts'
import { useEventDialog } from 'src/composables/useEventDialog.ts'
import { useNotification } from 'src/composables/useNotification.ts'

interface Props {
  event: EventEntity
}

const { success } = useNotification()
const props = defineProps<Props>()
const { openAttendEventDialog, openCancelAttendingEventDialog } = useEventDialog()
const { openLoginDialog } = useAuthDialog()

const onAttendClick = () => {
  if (useAuthStore().isAuthenticated) {
    openAttendEventDialog(props.event).onOk(() => {
      useEventStore().actionAttendEvent({
        eventId: props.event.id,
        rsvpStatus: 'test',
        isHost: false,
        role: 'participant',
        status: 'confirmed'
      } as Partial<EventAttendeeEntity>).then(() => {
        success('You are now attending this event!')
      })
    })
  } else {
    openLoginDialog()
  }
}

const onEditAttendenceClick = () => {
  openCancelAttendingEventDialog().onOk(() => {
    if (props.event.attendee) {
      useEventStore().actionUpdateAttendee({
        id: props.event.attendee?.id,
        status: 'cancelled'
      } as Partial<EventAttendeeEntity>).then(() => {
        success('Event attendance cancelled!')
      })
    }
  })
}
</script>

<template>
  <q-page-sticky v-if="event" expand position="bottom" :class="[Dark.isActive ? 'bg-dark' : 'bg-grey-2']">
    <div class="col row q-pa-md">
      <div class="col col-12 col-md-8 q-px-md min-width-200">
        <div class="text-body2 text-bold">{{ formatDate(event.startDate) }}</div>
        <div class="text-h6 text-bold">{{ event.name }}</div>
      </div>
      <div class="col col-12 col-md-4 row q-gutter-md justify-end no-wrap">
        <div class="column" v-if="useEventStore().getterUserIsAttendee()">
          <div class="text-subtitle1 text-bold">You're going!</div>
          <div><q-btn @click="onEditAttendenceClick" no-caps size="md" padding="none" flat color="primary" label="Edit RSVP"/></div>
        </div>

        <div class="row items-start">
          <ShareComponent class="q-mr-md"/>
          <q-btn v-if="!useEventStore().getterUserIsAttendee()" no-caps label="Attend" color="primary" @click="onAttendClick"/>
        </div>
      </div>
    </div>
  </q-page-sticky>
</template>

<style scoped lang="scss">

</style>
