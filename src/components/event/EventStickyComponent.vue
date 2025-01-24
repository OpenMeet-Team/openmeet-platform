<template>
  <q-page-sticky class="c-event-sticky-component" v-if="event" expand position="bottom" :class="[Dark.isActive ? 'bg-dark' : 'bg-grey-2']">
    <div class="col row q-py-md q-mx-auto" style="max-width: 1201px">
      <div class="col col-12 col-sm-6 q-px-md min-width-200">
        <div class="text-body2 text-bold">{{ formatDate(event.startDate) }}</div>
        <span v-if="event.maxAttendees">
          <span class="text-red">{{ spotsLeft > 0 ? `${spotsLeft} ${pluralize(spotsLeft, 'spot')} left` : 'No spots left' }}</span>
        </span>
        <div class="text-h6 text-bold">{{ event.name }}</div>
      </div>
      <div class="col col-12 col-sm-6 row q-gutter-md justify-end no-wrap">
        <div class="column" v-if="useEventStore().getterUserIsAttendee()">
          <div data-cy="event-attendee-status-confirmed" class="text-subtitle1 text-bold" v-if="event.attendee?.status === EventAttendeeStatus.Confirmed">You're going!</div>
          <div data-cy="event-attendee-status-pending" class="text-subtitle1 text-bold" v-if="event.attendee?.status === EventAttendeeStatus.Pending">You're pending approval!</div>
          <div data-cy="event-attendee-status-waitlist" class="text-subtitle1 text-bold" v-if="event.attendee?.status === EventAttendeeStatus.Waitlist">You're on the waitlist!</div>
          <div data-cy="event-attendee-status-rejected" class="text-subtitle1 text-bold" v-if="event.attendee?.status === EventAttendeeStatus.Rejected">You're rejected!</div>
          <div data-cy="event-attendee-status-cancelled" class="text-subtitle1 text-bold" v-if="event.attendee?.status === EventAttendeeStatus.Cancelled">You're cancelled!</div>
          <div><q-btn data-cy="event-edit-attendance-button" @click="onEditAttendenceClick" no-caps size="md"
              padding="none" flat color="primary" label="Edit RSVP" /></div>
        </div>
<!--
        <div class="column" v-if="event.attendee && event.attendee.status !== 'cancelled'">
          <div data-cy="event-attendee-status-confirmed" v-if="event.attendee.status === EventAttendeeStatus.Confirmed">You're going!</div>
          <div data-cy="event-attendee-status-pending" v-if="event.attendee.status === EventAttendeeStatus.Pending">You're pending!</div>
          <div data-cy="event-attendee-status-waitlist" v-if="event.attendee.status === EventAttendeeStatus.Waitlist">You're on the waitlist!</div>
          <div data-cy="event-attendee-status-rejected" v-if="event.attendee.status === EventAttendeeStatus.Rejected">You're rejected!</div>

          <div>
            <q-btn data-cy="event-edit-attendance-button"
                   @click="onEditAttendenceClick"
                   no-caps
                   size="md"
                   padding="none"
                   flat
                   color="primary"
                   label="Cancel RSVP" />
          </div> -->
        <div class="row items-start q-gutter-md">
          <ShareComponent class="col-4" />

          <q-btn :loading="isLoading"
                 class="col-3"
                 data-cy="event-attend-button"
                 v-if="!event.attendee || event.attendee.status === 'cancelled'"
                 no-caps
                 label="Attend"
                 color="primary"
                 :disable="new Date(event.startDate) < new Date()"
                 @click="onAttendClick" />

          <QRCodeComponent class="" />
        </div>
      </div>
    </div>
  </q-page-sticky>
</template>

<script setup lang="ts">

import ShareComponent from 'components/common/ShareComponent.vue'
import { EventAttendeeEntity, EventAttendeeStatus, EventEntity } from '../../types'
import { formatDate } from '../../utils/dateUtils'
import { Dark } from 'quasar'
import { useAuthStore } from '../../stores/auth-store'
import { useEventStore } from '../../stores/event-store'
import { useAuthDialog } from '../../composables/useAuthDialog'
import { useEventDialog } from '../../composables/useEventDialog'
import { useNotification } from '../../composables/useNotification'
import QRCodeComponent from '../common/QRCodeComponent.vue'
import { pluralize } from '../../utils/stringUtils'
import { ref, watch, computed } from 'vue'

interface Props {
  event: EventEntity
}

const { success, error } = useNotification()
const props = defineProps<Props>()
const { openAttendEventDialog, openCancelAttendingEventDialog, openEventAttendPendingDialog, openEventAttendWaitlistDialog, openEventAttendRejectedDialog } = useEventDialog()
const { openLoginDialog } = useAuthDialog()
const isLoading = ref(false)
const spotsLeft = computed(() => props.event.maxAttendees ? props.event.maxAttendees - (props.event.attendeesCount || 0) : 0)

// Add debugging logs
watch(() => props.event?.attendee, (newVal) => {
  console.log('Event attendee changed:', {
    hasAttendee: !!newVal,
    status: newVal?.status,
    raw: newVal
  })
}, { immediate: true })

// Log when buttons should show
const showAttendButton = computed(() => !props.event?.attendee || props.event.attendee.status === 'cancelled')
const showCancelButton = computed(() => props.event?.attendee && props.event.attendee.status !== 'cancelled')

watch([showAttendButton, showCancelButton], ([attend, cancel]) => {
  console.log('Button visibility:', {
    showAttend: attend,
    showCancel: cancel,
    attendeeStatus: props.event?.attendee?.status
  })
}, { immediate: true })

const onAttendClick = () => {
  if (useAuthStore().isAuthenticated) {
    isLoading.value = true
    openAttendEventDialog(props.event).onOk(({ approvalAnswer }) => {
      useEventStore().actionAttendEvent(props.event.slug, {
        approvalAnswer,
        status: 'pending'
      } as Partial<EventAttendeeEntity>).then(attendee => {
        if (attendee) {
          if (attendee.status === 'cancelled') {
            error('Unable to attend event at this time')
          } else if (attendee.status === EventAttendeeStatus.Pending) {
            openEventAttendPendingDialog()
          } else if (attendee.status === EventAttendeeStatus.Confirmed) {
            success('You are now attending this event!')
          } else if (attendee.status === EventAttendeeStatus.Waitlist) {
            openEventAttendWaitlistDialog()
          } else if (attendee.status === EventAttendeeStatus.Rejected) {
            openEventAttendRejectedDialog()
          }
        }
      }).finally(() => {
        isLoading.value = false
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

console.log('Event attendee status:', props.event?.attendee?.status)
console.log('Is cancelled?', props.event?.attendee?.status === 'cancelled')
</script>

<style scoped lang="scss"></style>
