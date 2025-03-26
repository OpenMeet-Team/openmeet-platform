<template>
  <!-- Attendance Button -->
  <div class="attendance-button">
    <!-- Authentication or Event Loading State -->
    <q-btn
      data-cy="event-attend-button"
      v-if="initialLoading || loading"
      :loading="true"
      color="primary"
    >
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
  if (isAuth && initialLoading.value && !hasCheckedAttendance.value) {
    // Only fetch if we haven't already checked and we're still loading
    hasCheckedAttendance.value = true

    // When auth state becomes true and we're still in initial loading,
    // refresh the event data to get the correct attendance status
    try {
      // Skip the API call if we already have attendee info
      if (!props.attendee) {
        loading.value = true
        console.log('Auth state changed, checking attendee status')

        // Use data from store if possible to avoid redundant API calls
        if (eventStore.event?.slug === props.event.slug) {
          console.log('Using existing event data from store after auth state change')
        } else {
          await eventStore.actionGetEventBySlug(props.event.slug)
        }
      }
    } catch (error) {
      console.error('Failed to refresh event data after authentication:', error)
    } finally {
      loading.value = false
      initialLoading.value = false
    }
  } else if (isAuth && !initialLoading.value) {
    console.log('Auth state changed but already finished loading')
  }
})

// Track if we've already fetched data
const hasCheckedAttendance = ref(false)

// Initialize the component properly
onMounted(async () => {
  console.log('EventAttendanceButton mounted, checking auth status')

  // If we already have attendee info, skip the fetch
  if (props.attendee) {
    console.log('Already have attendee info, skipping fetch:', props.attendee.status)
    initialLoading.value = false
    return
  }

  try {
    // Check if user is authenticated
    const isAuthenticated = await authSession.checkAuthStatus()

    if (isAuthenticated && !hasCheckedAttendance.value) {
      // Only make the API call once per component instance
      hasCheckedAttendance.value = true

      // Skip the API call if we're not authenticated or already have attendee info
      if (!props.attendee) {
        loading.value = true
        console.log('Attendee info missing, fetching event data for:', props.event.slug)
        // Use EventStore's existing data if available to avoid a new API call
        if (eventStore.event?.slug === props.event.slug) {
          console.log('Using existing EventStore data')
        } else {
          await eventStore.actionGetEventBySlug(props.event.slug)
        }
      }
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
