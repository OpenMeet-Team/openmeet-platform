<script setup lang="ts">

import EventFormComponent from '../event/EventFormBasicComponent.vue'
import { ref, defineEmits } from 'vue'
import { QDialog } from 'quasar'
import { EventEntity, GroupEntity } from '../../types'
import { EventSeriesEntity } from '../../types/event-series'
import { useRouter } from 'vue-router'

interface Props {
  group?: GroupEntity
}

defineProps<Props>()
const emit = defineEmits(['ok', 'hide'])

const dialogRef = ref<QDialog | null>(null)
const router = useRouter()

const onEventCreated = (event: EventEntity) => {
  console.log('Event created in dialog, navigating to:', event)

  if (dialogRef.value) {
    dialogRef.value.hide()

    // Emit the event to parent component instead of navigating directly
    // This allows the parent to handle linking to series or other actions
    emit('ok', event)
  }
}

const onSeriesCreated = (series: EventSeriesEntity) => {
  console.log('Series created in dialog, trying to navigate to template event:', series.templateEventSlug)

  if (dialogRef.value) {
    dialogRef.value.hide()

    // For series, we still navigate directly as before
    // If series has a templateEventSlug, navigate directly to it
    if (series.templateEventSlug) {
      console.log('Navigating directly to template event:', series.templateEventSlug)
      router.push({ name: 'EventPage', params: { slug: series.templateEventSlug } })
    } else if (series.events && series.events.length > 0) {
      // Fallback to first event if available
      const firstEvent = series.events[0]
      console.log('Navigating to first event of series:', firstEvent)
      router.push({ name: 'EventPage', params: { slug: firstEvent.slug } })
    } else {
      // Final fallback to series page
      console.log('No template event or events found, navigating to series page')
      router.push({ name: 'EventSeriesPage', params: { slug: series.slug } })
    }
  }
}

const onClose = () => {
  if (dialogRef.value) {
    dialogRef.value.hide()
    emit('hide')
  }
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
