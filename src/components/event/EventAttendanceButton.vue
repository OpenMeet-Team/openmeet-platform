<template>
  <!-- Attendance Button -->
  <div class="attendance-button" :class="$attrs.class">
    <!-- Loading State -->
    <q-btn
      data-cy="event-attend-button"
      v-if="loading"
      :loading="true"
      color="primary"
      no-caps
      class="full-width"
    >
      <template v-slot:loading>
        <q-spinner-dots />
      </template>
    </q-btn>

    <!-- Template View State - Only for authorized users -->
    <q-btn
      data-cy="event-template-materialize-button"
      v-else-if="isTemplateView && canMaterializeEvent"
      color="primary"
      outline
      @click="handleTemplateAttend"
      :label="'RSVP: Schedule & attend this event'"
      no-caps
      class="full-width"
    />

    <!-- Template View - Unauthorized users -->
    <q-btn
      data-cy="event-template-unauthorized-button"
      v-else-if="isTemplateView && !canMaterializeEvent"
      color="grey-6"
      outline
      disable
      no-caps
      class="full-width"
    >
      Only organizers can schedule events
    </q-btn>

    <!-- Need to join group before attending -->
    <q-card
      v-else-if="!attendee && needsToJoinGroup"
      flat
      bordered
      class="q-pa-md text-center"
    >
      <q-card-section>
        <q-icon name="sym_r_group" size="md" color="grey-6" class="q-mb-sm" />
        <div class="text-h6 q-mb-sm">Join {{ event.group?.name }} to RSVP</div>
        <p class="text-body2 text-grey-7 q-mb-md">
          This event requires you to be a member of the {{ event.group?.name }} group before you can attend.
        </p>
        <q-btn
          :to="`/groups/${event.group?.slug}`"
          color="primary"
          icon="sym_r_group_add"
          label="View Group"
          no-caps
          class="full-width"
        />
      </q-card-section>
    </q-card>

    <!-- No RSVP yet - Show both options -->
    <div v-else-if="!attendee" class="rsvp-button-group">
      <!-- RSVP Instructions -->
      <div class="rsvp-instructions q-mb-sm text-center">
        <div class="text-body2 text-grey-8 q-mb-xs">
          <q-icon name="sym_r_person_raised_hand" class="q-mr-xs" />
          Let the hosts know your plans!
        </div>
        <div class="text-caption text-grey-6">
          Click one of the buttons below to RSVP.
        </div>
      </div>
      <q-btn
        data-cy="event-attend-button"
        color="positive"
        icon="sym_r_check_circle"
        @click="handleAttend"
        :label="event.requireApproval ? 'Going (pending approval)' : 'Going'"
        no-caps
        class="full-width rsvp-yes-button"
      />
      <q-btn
        data-cy="event-decline-button"
        color="grey-7"
        icon="sym_r_cancel"
        outline
        @click="handleDecline"
        label="Can't go"
        no-caps
        class="full-width rsvp-no-button"
      />
    </div>

    <!-- Already RSVP'd No (Cancelled State) - Show current state with option to change -->
    <q-btn
      data-cy="event-not-attending-status"
      v-else-if="attendee.status === EventAttendeeStatus.Cancelled"
      color="positive"
      outline
      @click="handleChangeToGoing"
      no-caps
      class="full-width"
    >
      <div class="column items-center">
        <div class="text-weight-medium">
          <q-icon name="sym_r_check_circle" class="q-mr-xs" />
          {{ event.requireApproval ? 'Request to Go' : 'Change to Going' }}
        </div>
      </div>
    </q-btn>

    <!-- Pending Approval State -->
    <q-btn
      data-cy="event-pending-status"
      v-else-if="attendee.status === EventAttendeeStatus.Pending"
      color="grey-7"
      outline
      @click="handleLeave"
      no-caps
      class="full-width"
    >
      <div class="column items-center">
        <div class="text-weight-medium">
          <q-icon name="sym_r_cancel" class="q-mr-xs" />
          Cancel request
        </div>
      </div>
    </q-btn>

    <!-- Waitlist State -->
    <q-btn
      data-cy="event-waitlist-status"
      v-else-if="attendee.status === EventAttendeeStatus.Waitlist"
      color="grey-7"
      outline
      @click="handleLeave"
      no-caps
      class="full-width"
    >
      <div class="column items-center">
        <div class="text-weight-medium">
          <q-icon name="sym_r_cancel" class="q-mr-xs" />
          Leave waitlist
        </div>
      </div>
    </q-btn>

    <!-- Attending State -->
    <q-btn
      data-cy="event-going-status"
      v-else-if="attendee.status === EventAttendeeStatus.Confirmed"
      color="grey-7"
      outline
      @click="handleLeave"
      no-caps
      class="full-width"
    >
      <div class="column items-center">
        <div class="text-weight-medium">
          <q-icon name="sym_r_cancel" class="q-mr-xs" />
          Can't go anymore
        </div>
      </div>
    </q-btn>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import { useQuasar } from 'quasar'
import { useEventStore } from '../../stores/event-store'
import { useAuthStore } from '../../stores/auth-store'
import {
  EventEntity,
  EventAttendeeEntity,
  EventAttendeeStatus
} from '../../types'
import { GroupPermission } from '../../types/group'
import { EventAttendeePermission } from '../../types/event'
import { useAuth } from '../../composables/useAuth'
import { useAuthSession } from '../../boot/auth-session'
import { eventLoadingState } from '../../utils/eventLoadingState'

const $q = useQuasar()
const eventStore = useEventStore()
const authStore = useAuthStore()
const { goToLogin } = useAuth()
const authSession = useAuthSession()

const props = defineProps<{
  event: EventEntity;
  attendee?: EventAttendeeEntity | null;
  isTemplateView?: boolean;
  templateDate?: string;
}>()

const loading = ref(false)
const initialLoading = ref(true)

// Helper function to extract error message from API response
const getErrorMessage = (error: unknown, fallbackMessage: string): string => {
  if (error && typeof error === 'object' && 'response' in error) {
    const apiError = error as { response?: { data?: { message?: string } } }
    if (apiError.response?.data?.message) {
      return apiError.response.data.message
    }
  }
  if (error && typeof error === 'object' && 'message' in error) {
    const errorWithMessage = error as { message: string }
    return errorWithMessage.message
  }
  return fallbackMessage
}

// Check if user can materialize events (schedule new occurrences)
const canMaterializeEvent = computed(() => {
  if (!authStore.isFullyAuthenticated) return false

  // Check if user is the series owner
  const isSeriesOwner = props.event?.series?.user?.id === authStore.getUserId

  // Check if user has group management permissions
  const hasGroupManagePermission = eventStore.getterGroupMemberHasPermission(GroupPermission.ManageEvents)

  // Check if user has event management permissions
  const hasEventManagePermission = eventStore.getterUserHasPermission(EventAttendeePermission.ManageEvent)

  return isSeriesOwner || hasGroupManagePermission || hasEventManagePermission
})

// Check if user needs to join group before being able to attend
const needsToJoinGroup = computed(() => {
  // Must be authenticated to check membership
  if (!authStore.isFullyAuthenticated) return false

  // Only relevant for events that require group membership and have a group
  if (!props.event.requireGroupMembership || !props.event.group) return false

  // Check if user is not a member (groupMember is null) or is a guest
  if (!props.event.groupMember) return true

  // Guests are not allowed to attend group-restricted events
  if (props.event.groupMember.groupRole?.name === 'guest') return true

  return false
})

// Watch for changes in authentication state
watch(() => authStore.isFullyAuthenticated, async (isAuth) => {
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

// SECURITY: Using shared utility to manage event loading state instead of window globals

// Initialize the component properly
onMounted(async () => {
  console.log('EventAttendanceButton mounted, checking auth status')

  // Module-scoped cache is already initialized at the top of this file

  try {
    // Always start in loading state to prevent UI flicker
    initialLoading.value = true

    // Check if the parent EventPage is already loading this event data
    // This helps avoid redundant API calls when components mount
    const eventSlug = props.event.slug
    if (eventLoadingState.isEventBeingLoaded(eventSlug)) {
      console.log('Parent EventPage is already loading this event data, skipping redundant API call')
      hasCheckedAttendance.value = true
      return
    }

    // Check if user is authenticated (always do this check)
    const isAuthenticated = await authSession.checkAuthStatus()
    console.log('Auth status result:', isAuthenticated)

    if (isAuthenticated) {
      // If authenticated, we should check if we need a fresh check for attendance status
      const now = Date.now()
      const lastCheck = eventLoadingState.getLastEventAttendanceCheck(eventSlug)
      const timeSinceLastCheck = now - lastCheck

      // Only refresh if it's been more than 3 seconds since the last check
      // This prevents multiple components from triggering redundant API calls
      if (timeSinceLastCheck > 3000) {
        loading.value = true
        hasCheckedAttendance.value = true
        console.log('Authenticated, fetching fresh event data for:', eventSlug)

        // Update our tracking timestamp
        eventLoadingState.setLastEventAttendanceCheck(eventSlug, now)

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
  if (!authStore.isFullyAuthenticated) {
    // Save the intent to attend after login
    console.log('User not authenticated, opening login dialog')
    goToLogin()
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
      message: getErrorMessage(error, 'Failed to schedule and join event. Please try again.')
    })
  } finally {
    loading.value = false
  }
}

const handleAttend = async () => {
  if (!authStore.isFullyAuthenticated) {
    // Save the intent to attend after login
    console.log('User not authenticated, opening login dialog')
    // We'll use the auth state watcher to handle post-login attendance
    goToLogin()
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
    const attendee = await eventStore.actionAttendEvent(props.event.slug, { status })
    console.log('Attendance API response:', attendee)

    // Force a refresh of event data to ensure UI reflects the latest state
    // This is a user-initiated action, so we always want to refresh
    const eventSlug = props.event.slug
    eventLoadingState.setLastEventAttendanceCheck(eventSlug, Date.now())
    await eventStore.actionGetEventBySlug(eventSlug)
    console.log('Updated event data after attending:', eventStore.event?.attendee?.status)

    // Emit a custom event to notify other components about the status change
    // Use the actual status from the API response, as it's most up-to-date
    const currentStatus = attendee?.status || eventStore.event?.attendee?.status || EventAttendeeStatus.Confirmed
    window.dispatchEvent(new CustomEvent('attendee-status-changed', {
      detail: {
        eventSlug,
        status: currentStatus,
        timestamp: Date.now()
      }
    }))
    console.log('Emitted attendee-status-changed event with status:', currentStatus)

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
      message: getErrorMessage(error, 'Failed to join event. Please try again.')
    })
  } finally {
    loading.value = false
  }
}

const handleChangeToGoing = async () => {
  if (!authStore.isFullyAuthenticated) {
    console.log('User not authenticated, opening login dialog')
    goToLogin()
    return
  }

  try {
    loading.value = true
    // Verify auth status again to ensure token is valid
    await authSession.checkAuthStatus()

    console.log('Changing from not going to going')

    // Respect approval requirements - user needs approval each time they RSVP yes
    const status = props.event.requireApproval
      ? EventAttendeeStatus.Pending
      : EventAttendeeStatus.Confirmed

    console.log('Setting status to:', status)
    await eventStore.actionAttendEvent(props.event.slug, { status })

    // Force a refresh of event data to ensure UI reflects the latest state
    const eventSlug = props.event.slug
    eventLoadingState.setLastEventAttendanceCheck(eventSlug, Date.now())
    await eventStore.actionGetEventBySlug(eventSlug)

    // Emit a custom event to notify other components about the status change
    window.dispatchEvent(new CustomEvent('attendee-status-changed', {
      detail: {
        eventSlug,
        status,
        timestamp: Date.now()
      }
    }))

    $q.notify({
      type: 'positive',
      message: props.event.requireApproval
        ? 'Request sent! Waiting for approval.'
        : 'You are now attending this event!'
    })
  } catch (error) {
    console.error('Error changing to going:', error)
    $q.notify({
      type: 'negative',
      message: getErrorMessage(error, 'Failed to update RSVP. Please try again.')
    })
  } finally {
    loading.value = false
  }
}

const handleDecline = async () => {
  if (!authStore.isFullyAuthenticated) {
    console.log('User not authenticated, opening login dialog')
    goToLogin()
    return
  }

  try {
    loading.value = true
    // Verify auth status again to ensure token is valid
    await authSession.checkAuthStatus()

    console.log('Declining attendance for event:', props.event.slug)

    // Create attendance record with cancelled status
    await eventStore.actionAttendEvent(props.event.slug, { status: EventAttendeeStatus.Cancelled })

    // Force a refresh of event data to ensure UI reflects the latest state
    const eventSlug = props.event.slug
    eventLoadingState.setLastEventAttendanceCheck(eventSlug, Date.now())
    await eventStore.actionGetEventBySlug(eventSlug)

    // Emit a custom event to notify other components about the status change
    window.dispatchEvent(new CustomEvent('attendee-status-changed', {
      detail: {
        eventSlug,
        status: EventAttendeeStatus.Cancelled,
        timestamp: Date.now()
      }
    }))

    $q.notify({
      type: 'info',
      message: 'RSVP updated - you have declined this event'
    })
  } catch (error) {
    console.error('Error declining event:', error)
    $q.notify({
      type: 'negative',
      message: getErrorMessage(error, 'Failed to update RSVP. Please try again.')
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

    // Log the current attendee status before cancellation
    console.log('Current attendee status before cancellation:', {
      status: props.attendee?.status,
      id: props.attendee?.id
    })

    // Call the store action to cancel attendance
    await eventStore.actionCancelAttending(props.event)

    // Log the store state immediately after the API call
    console.log('Store attendee state after API call:', {
      status: eventStore.event?.attendee?.status,
      id: eventStore.event?.attendee?.id
    })

    $q.notify({
      type: 'info',
      message: 'You have left this event'
    })

    // Force a refresh of the event data to ensure we have the latest state
    console.log('Refreshing event data after cancellation')
    eventLoadingState.setLastEventAttendanceCheck(eventSlug, Date.now())
    await eventStore.actionGetEventBySlug(eventSlug)

    // Log the final state after refresh to help diagnose any issues
    console.log('Final event data after refresh:', {
      attendeeStatus: eventStore.event?.attendee?.status,
      attendeeId: eventStore.event?.attendee?.id,
      hasAttendee: !!eventStore.event?.attendee,
      buttonShouldShow: !eventStore.event?.attendee || eventStore.event?.attendee?.status === EventAttendeeStatus.Cancelled ? 'Attend' : 'Leave'
    })

    // Instead of directly modifying props (which Vue warns against),
    // we'll rely on the event store update and custom event
    console.log('Skipping direct prop modification to avoid Vue warning about mutating props')

    // Emit a custom event that the discussion component can listen for
    // This helps components that don't have direct access to the attendee prop
    window.dispatchEvent(new CustomEvent('attendee-status-changed', {
      detail: {
        eventSlug,
        status: EventAttendeeStatus.Cancelled,
        timestamp: Date.now()
      }
    }))
    console.log('Emitted attendee-status-changed event for components to detect')
  } catch (error) {
    console.error('Error leaving event:', error)
    $q.notify({
      type: 'negative',
      message: getErrorMessage(error, 'Failed to leave event. Please try again.')
    })
  } finally {
    loading.value = false
  }
}
</script>

<style lang="scss" scoped>
.attendance-button {
  .rsvp-button-group {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .rsvp-yes-button {
    font-weight: 600;

    &:not(.q-btn--outline) {
      background: var(--q-positive);
      color: white;
    }

    &.q-btn--outline {
      border-color: var(--q-positive);
      color: var(--q-positive);

      &:hover {
        background: var(--q-positive);
        color: white;
      }
    }
  }

  .rsvp-no-button {
    font-weight: 500;

    &.q-btn--outline {
      border-color: var(--q-grey-7);
      color: var(--q-grey-7);

      &:hover {
        background: var(--q-grey-7);
        color: white;
      }
    }
  }

  // State-based button styling
  .q-btn .column {
    line-height: 1.2;

    .text-caption {
      opacity: 0.7;
      font-size: 0.75rem;
      margin-top: 2px;
    }
  }

  // Button hover effects for state buttons
  .q-btn:not(.q-btn--disable):hover .text-caption {
    opacity: 1;
  }
}
</style>
