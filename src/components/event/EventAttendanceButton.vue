<template>
  <!-- Attendance Button -->
  <div class="attendance-button">
    <!-- Loading State -->
    <q-btn data-cy="event-attend-button" v-if="loading" :loading="true" color="primary">
      <template v-slot:loading>
        <q-spinner-dots />
      </template>
    </q-btn>

    <!-- Not Attending or Cancelled State -->
    <q-btn
      data-cy="event-attend-button"
      v-else-if="!attendee || attendee.status === EventAttendeeStatus.Cancelled"
      color="primary"
      @click="handleAttend"
      :label="event.requireApproval ? 'Request to Attend' : 'Attend'"
    />

    <!-- Pending Approval State -->
    <q-btn
      data-cy="event-attend-button"
      v-else-if="attendee.status === EventAttendeeStatus.Pending"
      color="warning"
      disable
    >
      Pending Approval
    </q-btn>

    <!-- Waitlist State -->
    <q-btn data-cy="event-attend-button"
      v-else-if="attendee.status === EventAttendeeStatus.Waitlist"
      color="orange"
      @click="handleLeave"
    >
      Leave Waitlist
    </q-btn>

    <!-- Attending State -->
    <q-btn data-cy="event-attend-button"
      v-else-if="attendee.status === EventAttendeeStatus.Confirmed"
      color="negative"
      @click="handleLeave"
    >
      Leave Event
    </q-btn>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useEventStore } from '../../stores/event-store'
import { useAuthStore } from '../../stores/auth-store'
import {
  EventEntity,
  EventAttendeeEntity,
  EventAttendeeStatus
} from '../../types'
import { useAuthDialog } from '../../composables/useAuthDialog'
import { useAuthSession } from '../../boot/auth-session'

const $q = useQuasar()
const eventStore = useEventStore()
const authStore = useAuthStore()
const authDialog = useAuthDialog()
const authSession = useAuthSession()

const props = defineProps<{
  event: EventEntity;
  attendee?: EventAttendeeEntity | null;
}>()

const loading = ref(false)
const initialLoading = ref(true)

// Watch for changes in authentication state
watch(() => authStore.isAuthenticated, async (isAuth) => {
  console.log('Auth state changed:', isAuth)

  // When user becomes authenticated, always refresh attendance data
  if (isAuth) {
    try {
      // Start loading state
      loading.value = true
      hasCheckedAttendance.value = true
      console.log('Auth state changed to true, refreshing event and attendance data')

      // Always fetch fresh data from server to ensure we have latest attendance status
      await eventStore.actionGetEventBySlug(props.event.slug)
      console.log('Updated attendee status after auth change:', eventStore.event?.attendee?.status)
    } catch (error) {
      console.error('Failed to refresh event data after authentication:', error)
    } finally {
      loading.value = false
      initialLoading.value = false
    }
  } else if (!isAuth) {
    // If user logs out, we should reset the attendance status
    console.log('User logged out, resetting attendance state')
    // Don't need to fetch anything, just update UI state
    initialLoading.value = false
    loading.value = false
  }
})

// Track if we've already fetched data
const hasCheckedAttendance = ref(false)

// Initialize the component properly
onMounted(async () => {
  console.log('EventAttendanceButton mounted, checking auth status')

  try {
    // Always start in loading state to prevent UI flicker
    initialLoading.value = true

    // Check if user is authenticated (always do this check)
    const isAuthenticated = await authSession.checkAuthStatus()
    console.log('Auth status result:', isAuthenticated)

    if (isAuthenticated) {
      // If authenticated, we should always force a fresh check for attendance status
      // This ensures we have the latest data from the server
      loading.value = true
      hasCheckedAttendance.value = true
      console.log('Authenticated, fetching fresh event data for:', props.event.slug)

      // Always get fresh data from the server to ensure we have latest attendance status
      await eventStore.actionGetEventBySlug(props.event.slug)
      console.log('Updated attendee status:', eventStore.event?.attendee?.status)
    } else {
      console.log('User not authenticated, skipping attendance check')
    }
  } catch (error) {
    console.error('Error during initialization:', error)
  } finally {
    loading.value = false
    initialLoading.value = false
  }
})

const handleAttend = async () => {
  if (!authStore.isAuthenticated) {
    // Save the intent to attend after login
    console.log('User not authenticated, opening login dialog')
    // We'll use the auth state watcher to handle post-login attendance
    authDialog.openLoginDialog()
    return
  }

  try {
    loading.value = true
    // Verify auth status again to ensure token is valid
    await authSession.checkAuthStatus()

    const status = props.event.requireApproval
      ? EventAttendeeStatus.Pending
      : EventAttendeeStatus.Confirmed

    console.log('Sending attend request with status:', status)
    await eventStore.actionAttendEvent(props.event.slug, { status })

    // Force a refresh of event data to ensure UI reflects the latest state
    await eventStore.actionGetEventBySlug(props.event.slug)
    console.log('Updated event data after attending:', eventStore.event?.attendee?.status)

    $q.notify({
      type: 'positive',
      message: props.event.requireApproval
        ? 'Request sent! Waiting for approval.'
        : 'You are now attending this event!'
    })
  } catch (error) {
    console.error('Error attending event:', error)
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
    // Verify auth status again to ensure token is valid
    await authSession.checkAuthStatus()

    console.log('Cancelling attendance for event:', props.event.slug)
    await eventStore.actionCancelAttending(props.event)

    $q.notify({
      type: 'info',
      message: 'You have left this event'
    })

    // Force a refresh of the event data to ensure we have the latest state
    console.log('Refreshing event data after cancellation')
    await eventStore.actionGetEventBySlug(props.event.slug)
    console.log('Updated event data after cancellation:', eventStore.event?.attendee?.status)
  } catch (error) {
    console.error('Error leaving event:', error)
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
