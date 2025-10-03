<template>
  <div class="event-attendance-status">
    <!-- Attendance Confirmed Banner -->
    <q-banner
      v-if="isAttending"
      class="attendance-confirmed-banner q-mb-md"
      rounded
    >
      <template v-slot:avatar>
        <q-icon name="sym_r_check_circle" size="md" color="positive" />
      </template>
      <div>
        <div class="text-h6 text-positive text-weight-bold">You're Attending!</div>
        <div class="text-body2">Chat available below</div>
      </div>
    </q-banner>

    <!-- Pending Approval Banner -->
    <q-banner
      v-if="isPending"
      class="attendance-pending-banner q-mb-md"
      rounded
    >
      <template v-slot:avatar>
        <q-icon name="sym_r_schedule" size="md" color="warning" />
      </template>
      <div>
        <div class="text-h6 text-warning text-weight-bold">Pending Approval</div>
        <div class="text-body2">Awaiting organizer approval</div>
      </div>
    </q-banner>

    <!-- Waitlist Banner -->
    <q-banner
      v-if="isWaitlisted"
      class="attendance-waitlist-banner q-mb-md"
      rounded
    >
      <template v-slot:avatar>
        <q-icon name="sym_r_hourglass_empty" size="md" color="orange" />
      </template>
      <div>
        <div class="text-h6 text-orange text-weight-bold">On Waitlist</div>
        <div class="text-body2">You'll be notified if space opens</div>
      </div>
    </q-banner>

    <!-- Rejected Banner -->
    <q-banner
      v-if="isRejected"
      class="attendance-rejected-banner q-mb-md"
      rounded
    >
      <template v-slot:avatar>
        <q-icon name="sym_r_cancel" size="md" color="negative" />
      </template>
      <div>
        <div class="text-h6 text-negative text-weight-bold">Not Approved</div>
        <div class="text-body2">Request was not approved</div>
      </div>
    </q-banner>

    <!-- Not Attending Banner -->
    <q-banner
      v-if="isCancelled"
      class="attendance-cancelled-banner q-mb-md"
      rounded
    >
      <template v-slot:avatar>
        <q-icon name="sym_r_event_busy" size="md" color="grey-7" />
      </template>
      <div>
        <div class="text-h6 text-grey-8 text-weight-bold">Not Attending</div>
        <div class="text-body2">Change your mind?</div>
      </div>
    </q-banner>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { EventEntity, EventAttendeeEntity, EventAttendeeStatus } from '../../types'
import { useEventStore } from '../../stores/event-store'

const props = defineProps<{
  event: EventEntity;
  attendee?: EventAttendeeEntity | null;
}>()

const isAttending = computed(() => {
  return useEventStore().getterUserIsAttendee() &&
         props.attendee?.status === EventAttendeeStatus.Confirmed
})

const isPending = computed(() => {
  return props.attendee?.status === EventAttendeeStatus.Pending
})

const isWaitlisted = computed(() => {
  return props.attendee?.status === EventAttendeeStatus.Waitlist
})

const isRejected = computed(() => {
  return props.attendee?.status === EventAttendeeStatus.Rejected
})

const isCancelled = computed(() => {
  return props.attendee?.status === EventAttendeeStatus.Cancelled
})
</script>

<style scoped lang="scss">
/* RSVP Banner Styling */
.attendance-confirmed-banner {
  background: linear-gradient(135deg, rgba(96, 203, 164, 0.15) 0%, rgba(96, 203, 164, 0.08) 100%);
  border-left: 4px solid var(--q-positive);

  :deep(.q-banner__avatar) {
    color: var(--q-positive);
  }
}

.attendance-pending-banner {
  background: linear-gradient(135deg, rgba(255, 182, 119, 0.15) 0%, rgba(255, 182, 119, 0.08) 100%);
  border-left: 4px solid var(--q-warning);

  :deep(.q-banner__avatar) {
    color: var(--q-warning);
  }
}

.attendance-waitlist-banner {
  background: linear-gradient(135deg, rgba(255, 182, 119, 0.12) 0%, rgba(255, 182, 119, 0.06) 100%);
  border-left: 4px solid var(--q-warning);

  :deep(.q-banner__avatar) {
    color: var(--q-warning);
  }
}

.attendance-rejected-banner {
  background: linear-gradient(135deg, rgba(253, 167, 204, 0.15) 0%, rgba(253, 167, 204, 0.08) 100%);
  border-left: 4px solid var(--q-negative);

  :deep(.q-banner__avatar) {
    color: var(--q-negative);
  }
}

.attendance-cancelled-banner {
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.08) 0%, rgba(0, 0, 0, 0.04) 100%);
  border-left: 4px solid var(--q-grey-7);

  :deep(.q-banner__avatar) {
    color: var(--q-grey-7);
  }
}

/* Dark mode adjustments for banners */
body.body--dark {
  .attendance-confirmed-banner {
    background: linear-gradient(135deg, rgba(96, 203, 164, 0.25) 0%, rgba(96, 203, 164, 0.12) 100%);
  }

  .attendance-pending-banner {
    background: linear-gradient(135deg, rgba(255, 182, 119, 0.25) 0%, rgba(255, 182, 119, 0.12) 100%);
  }

  .attendance-waitlist-banner {
    background: linear-gradient(135deg, rgba(255, 182, 119, 0.2) 0%, rgba(255, 182, 119, 0.1) 100%);
  }

  .attendance-rejected-banner {
    background: linear-gradient(135deg, rgba(253, 167, 204, 0.25) 0%, rgba(253, 167, 204, 0.12) 100%);
  }

  .attendance-cancelled-banner {
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.06) 100%);
  }
}
</style>
