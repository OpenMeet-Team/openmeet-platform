<script setup lang="ts">
import { ref } from 'vue'

// Define event types
type EventType = 'online' | 'in-person' | 'hybrid'

// Reactive property to store selected event type
const selectedEventType = ref<EventType | null>(null)

// Handle change when an event type is selected
const onEventTypeChange = (value: EventType) => {
  selectedEventType.value = value
  console.log('Selected Event Type:', selectedEventType.value)
}
</script>

<template>
  <q-select
    v-model="selectedEventType"
    :options="[
      { label: 'Online', value: 'online' },
      { label: 'In-Person', value: 'in-person' },
      { label: 'Hybrid', value: 'hybrid' }
    ]"
    label="Select Event Type"
    emit-value
    outlined
    @update:model-value="onEventTypeChange"
  />
</template>

<style scoped>
/* Add custom styles if needed */
</style>
