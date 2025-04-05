<template>
  <q-page padding class="q-mx-auto q-px-xl" style="max-width: 500px;">
    <DashboardTitle :backTo="{ name: 'DashboardEventsPage' }" label="Create New Event" />

    <EventFormComponent class="col"
      @created="onEventCreated"
      @series-created="handleSeriesCreated"
      @close="onClose" />
  </q-page>
</template>

<script setup lang="ts">
import EventFormComponent from '../../components/event/EventFormBasicComponent.vue'
import { useRouter } from 'vue-router'
import DashboardTitle from '../../components/dashboard/DashboardTitle.vue'
import { EventSeriesEntity } from '../../types/event-series'
import { EventEntity } from '../../types'

const router = useRouter()

// Handle when a regular event is created
const onEventCreated = (event: EventEntity) => {
  console.log('Event created, navigating to:', event)
  // Force navigation even if event object is incomplete
  if (event && event.slug) {
    // Use the router directly for more reliable navigation
    router.push({ name: 'EventPage', params: { slug: event.slug } })
  } else {
    console.error('Cannot navigate: event is missing slug property', event)
  }
}

// Handle navigation when a series is created
const handleSeriesCreated = (series: EventSeriesEntity) => {
  console.log('Series created, trying to navigate to first event:', series)
  // If the series has events, navigate to the first one
  if (series.events && series.events.length > 0) {
    const firstEvent = series.events[0]
    console.log('Navigating to first event of series:', firstEvent)
    if (firstEvent.slug) {
      // Use the router directly for more reliable navigation
      router.push({ name: 'EventPage', params: { slug: firstEvent.slug } })
    }
  } else {
    console.log('No events in series, going back to dashboard')
    // Fallback to series page or dashboard if available
    router.push({ name: 'DashboardEventsPage' })
  }
}

const onClose = () => {
  router.push({ name: 'DashboardEventsPage' })
}
</script>
