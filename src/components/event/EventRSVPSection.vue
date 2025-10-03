<template>
  <div class="event-rsvp-section">
    <EventAttendanceStatus :event="event" :attendee="event.attendee" />
    <EventAttendanceButton
      :event="event"
      :attendee="event.attendee"
      :is-template-view="isTemplateView"
      :template-date="templateDate"
      class="action-button"
    />
  </div>
</template>

<script setup lang="ts">
import { EventEntity } from '../../types'
import EventAttendanceStatus from './EventAttendanceStatus.vue'
import EventAttendanceButton from './EventAttendanceButton.vue'

defineProps<{
  event: EventEntity;
  isTemplateView?: boolean;
  templateDate?: string | null;
}>()
</script>

<style scoped lang="scss">
.event-rsvp-section {
  width: 100%;
}

/* Action button styles for uniformity */
.action-button {
  min-height: 44px;

  :deep(.q-btn) {
    min-height: 44px;
    width: 100%;
  }

  :deep(.q-btn__content) {
    justify-content: flex-start;
    padding: 0 16px;
  }
}
</style>
