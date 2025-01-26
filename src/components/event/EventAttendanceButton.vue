<template>
  <!-- Attendance Button -->
  <div class="attendance-button">
    <!-- Loading State -->
    <q-btn v-if="loading" :loading="true" color="primary">
      <template v-slot:loading>
        <q-spinner-dots />
      </template>
    </q-btn>

    <!-- Not Attending or Cancelled State -->
    <q-btn
      v-else-if="!attendee || attendee.status === EventAttendeeStatus.Cancelled"
      color="primary"
      @click="handleAttend"
      :label="event.requireApproval ? 'Request to Attend' : 'Attend'"
    />

    <!-- Pending Approval State -->
    <q-btn
      v-else-if="attendee.status === EventAttendeeStatus.Pending"
      color="warning"
      disable
    >
      Pending Approval
    </q-btn>

    <!-- Waitlist State -->
    <q-btn
      v-else-if="attendee.status === EventAttendeeStatus.Waitlist"
      color="orange"
      @click="handleLeave"
    >
      Leave Waitlist
    </q-btn>

    <!-- Attending State -->
    <q-btn
      v-else-if="attendee.status === EventAttendeeStatus.Confirmed"
      no-caps
      text-color="black"
      color="negative"
      @click="handleLeave"
    >
      Leave Event
    </q-btn>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useQuasar } from 'quasar'
import { useEventStore } from '../../stores/event-store'
import { useAuthStore } from '../../stores/auth-store'
import {
  EventEntity,
  EventAttendeeEntity,
  EventAttendeeStatus
} from '../../types'
import { useAuthDialog } from '../../composables/useAuthDialog'

const $q = useQuasar()
const eventStore = useEventStore()
const authStore = useAuthStore()
const authDialog = useAuthDialog()

const props = defineProps<{
  event: EventEntity;
  attendee?: EventAttendeeEntity | null;
}>()

const loading = ref(false)

const handleAttend = async () => {
  if (!authStore.isAuthenticated) {
    authDialog.openLoginDialog()
    return
  }

  try {
    loading.value = true
    const status = props.event.requireApproval
      ? EventAttendeeStatus.Pending
      : EventAttendeeStatus.Confirmed

    await eventStore.actionAttendEvent(props.event.slug, { status })
    $q.notify({
      type: 'positive',
      message: props.event.requireApproval
        ? 'Request sent! Waiting for approval.'
        : 'You are now attending this event!'
    })
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: 'Failed to join event. Please try again.'
    })
  } finally {
    loading.value = false
  }
}

const handleLeave = async () => {
  try {
    loading.value = true
    await eventStore.actionCancelAttending(props.event)
    $q.notify({
      type: 'info',
      message: 'You have left this event'
    })
    // Force a refresh of the event data to ensure we have the latest state
    await eventStore.actionGetEventBySlug(props.event.slug)
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: 'Failed to leave event. Please try again.'
    })
  } finally {
    loading.value = false
  }
}
</script>

<style lang="scss" scoped>
.attendance-button {
}
</style>
