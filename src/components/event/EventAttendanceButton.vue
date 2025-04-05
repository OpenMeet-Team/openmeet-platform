<template>
  <!-- Attendance Button -->
  <div class="attendance-button">
    <!-- Loading State -->
    <q-btn data-cy="event-attend-button" v-if="loading" :loading="true" color="primary">
      <template v-slot:loading>
        <q-spinner-dots />
      </template>
    </q-btn>

    <!-- Template View State -->
    <q-btn
      data-cy="event-template-materialize-button"
      v-else-if="isTemplateView"
      color="primary"
      @click="handleTemplateAttend"
      :label="'Schedule & Attend'"
    />

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
  isTemplateView?: boolean;
  templateDate?: string;
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

// Add type declaration for global window property
declare global {
  interface Window {
    lastEventAttendanceCheck?: Record<string, number>;
  }
}

// Initialize the component properly
onMounted(async () => {
  console.log('EventAttendanceButton mounted, checking auth status')

  // Initialize global tracker if needed
  if (!window.lastEventAttendanceCheck) {
    window.lastEventAttendanceCheck = {}
  }

  try {
    // Always start in loading state to prevent UI flicker
    initialLoading.value = true

    // Check if user is authenticated (always do this check)
    const isAuthenticated = await authSession.checkAuthStatus()
    console.log('Auth status result:', isAuthenticated)

    if (isAuthenticated) {
      // If authenticated, we should check if we need a fresh check for attendance status
      const eventSlug = props.event.slug
      const now = Date.now()
      const lastCheck = window.lastEventAttendanceCheck[eventSlug] || 0
      const timeSinceLastCheck = now - lastCheck

      // Only refresh if it's been more than 3 seconds since the last check
      // This prevents multiple components from triggering redundant API calls
      if (timeSinceLastCheck > 3000) {
        loading.value = true
        hasCheckedAttendance.value = true
        console.log('Authenticated, fetching fresh event data for:', eventSlug)

        // Update our tracking timestamp
        window.lastEventAttendanceCheck[eventSlug] = now

        // Get fresh data from the server to ensure we have latest attendance status
        await eventStore.actionGetEventBySlug(eventSlug)
        console.log('Updated attendee status:', eventStore.event?.attendee?.status)
      } else {
        console.log(`Skipping redundant attendance check (last check was ${timeSinceLastCheck}ms ago)`)
        hasCheckedAttendance.value = true
      }
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

// Handle attendance for template view (unmaterialized event)
const handleTemplateAttend = async () => {
  if (!authStore.isAuthenticated) {
    // Save the intent to attend after login
    console.log('User not authenticated, opening login dialog')
    authDialog.openLoginDialog()
    return
  }

  try {
    loading.value = true

    // First, verify auth status to ensure token is valid
    await authSession.checkAuthStatus()

    // Check if we have all required data
    if (!props.event.seriesSlug || !props.templateDate) {
      throw new Error('Missing series slug or template date for materialization')
    }

    console.log('Materializing occurrence before attending:', {
      seriesSlug: props.event.seriesSlug,
      templateDate: props.templateDate
    })

    // Materialize the occurrence first using the centralized function
    // Pass false to prevent auto-navigation
    const materializedEvent = await eventStore.actionMaterializeOccurrence(
      props.event.seriesSlug,
      props.templateDate,
      false // Don't auto-navigate
    )

    // Then attend the newly materialized event
    const status = materializedEvent.requireApproval
      ? EventAttendeeStatus.Pending
      : EventAttendeeStatus.Confirmed

    console.log('Attending newly materialized event:', materializedEvent.slug)
    await eventStore.actionAttendEvent(materializedEvent.slug, { status })

    // Show success notification
    $q.notify({
      type: 'positive',
      message: materializedEvent.requireApproval
        ? 'Event scheduled! Request sent for attendance approval.'
        : 'Event scheduled! You are now attending this event.'
    })

    // Navigate to the materialized event using window.location
    window.location.href = `/events/${materializedEvent.slug}`
  } catch (error) {
    console.error('Error materializing and attending event:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to schedule and join event. Please try again.'
    })
  } finally {
    loading.value = false
  }
}

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
    // This is a user-initiated action, so we always want to refresh
    const eventSlug = props.event.slug
    window.lastEventAttendanceCheck[eventSlug] = Date.now()
    await eventStore.actionGetEventBySlug(eventSlug)
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

    const eventSlug = props.event.slug
    console.log('Cancelling attendance for event:', eventSlug)
    await eventStore.actionCancelAttending(props.event)

    $q.notify({
      type: 'info',
      message: 'You have left this event'
    })

    // Force a refresh of the event data to ensure we have the latest state
    // This is a user-initiated action, so we always want to refresh
    console.log('Refreshing event data after cancellation')
    window.lastEventAttendanceCheck[eventSlug] = Date.now()
    await eventStore.actionGetEventBySlug(eventSlug)
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
