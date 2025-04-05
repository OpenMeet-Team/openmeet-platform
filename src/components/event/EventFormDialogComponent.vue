<script setup lang="ts">

import EventFormComponent from '../event/EventFormBasicComponent.vue'
import { ref } from 'vue'
import { QDialog } from 'quasar'
import { EventEntity, GroupEntity } from '../../types'
import { EventSeriesEntity } from '../../types/event-series'
import { useRouter } from 'vue-router'

interface Props {
  group?: GroupEntity
}

defineProps<Props>()

const dialogRef = ref<QDialog | null>(null)
const router = useRouter()

const onEventCreated = (event: EventEntity) => {
  console.log('Event created in dialog, navigating to:', event)

  if (dialogRef.value) {
    dialogRef.value.hide()

    // Ensure we have a slug before navigating
    if (event && event.slug) {
      // Use direct router navigation for reliability
      router.push({ name: 'EventPage', params: { slug: event.slug } })
    } else {
      console.error('Cannot navigate: event is missing slug property', event)
    }
  }
}

const onSeriesCreated = (series: EventSeriesEntity) => {
  console.log('Series created in dialog, trying to navigate to first event:', series)

  if (dialogRef.value) {
    dialogRef.value.hide()
    // If the series has events, navigate to the first one
    if (series.events && series.events.length > 0) {
      const firstEvent = series.events[0]
      console.log('Navigating to first event of series:', firstEvent)
      if (firstEvent.slug) {
        // Use direct router navigation for reliability
        router.push({ name: 'EventPage', params: { slug: firstEvent.slug } })
      }
    }
  }
}

const onClose = () => {
  if (dialogRef.value) dialogRef.value.hide()
}
</script>

<template>
  <q-dialog ref="dialogRef" class="c-event-form-dialog-component" data-cy="event-form-dialog">
    <q-card class="full-width q-pa-md event-form-card" style="max-width: 500px">
      <div class="row q-mb-xl">
        <h1 class="text-h4 q-my-none">Create an event</h1>
      </div>

      <EventFormComponent
        :group="group"
        @created="onEventCreated"
        @series-created="onSeriesCreated"
        @close="onClose"
      />
    </q-card>
  </q-dialog>
</template>

<style scoped lang="scss">
.event-form-card {
  border-radius: 24px;
}
</style>
