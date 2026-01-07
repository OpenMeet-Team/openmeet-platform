<template>
  <q-page padding class="q-mx-auto q-px-md q-px-lg-xl" style="max-width: 1200px;">
    <DashboardTitle defaultBack label="Create New Event" />

    <EventFormComponent class="col"
      :group="preselectedGroup"
      :initial-date="route.query.date as string"
      :duplicate-event-slug="route.query.duplicate as string"
      @created="onEventCreated"
      @series-created="handleSeriesCreated"
      @close="onClose" />
  </q-page>
</template>

<script setup lang="ts">
import EventFormComponent from '../../components/event/EventFormBasicComponent.vue'
import { useRouter, useRoute } from 'vue-router'
import DashboardTitle from '../../components/dashboard/DashboardTitle.vue'
import { EventSeriesEntity } from '../../types/event-series'
import { EventEntity, GroupEntity } from '../../types'
import { ref, onMounted } from 'vue'
import { groupsApi } from '../../api/groups'

const router = useRouter()
const route = useRoute()
const preselectedGroup = ref<GroupEntity | undefined>()

// Load preselected group if groupSlug is provided in query
onMounted(async () => {
  const groupSlug = route.query.groupSlug as string
  if (groupSlug) {
    try {
      const response = await groupsApi.getBySlug(groupSlug)
      preselectedGroup.value = response.data
    } catch (error) {
      console.error('Failed to load preselected group:', error)
    }
  }
})

// Handle when a regular event is created
const onEventCreated = (event: EventEntity) => {
  console.log('Event created, navigating to:', event)
  if (event && event.slug) {
    // Drafts go to edit page, published events go to view page
    if (event.status === 'draft') {
      router.push({ name: 'DashboardEventPage', params: { slug: event.slug } })
    } else {
      router.push({ name: 'EventPage', params: { slug: event.slug } })
    }
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

// Handle when user closes/cancels the form
const onClose = () => {
  // Use browser history to go back to where user came from
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push({ name: 'DashboardEventsPage' })
  }
}
</script>
