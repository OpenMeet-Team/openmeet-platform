<template>
  <q-page padding class="q-mx-auto q-px-md q-px-lg-xl" style="max-width: 1200px;">
    <div class="row items-center q-mb-lg">
      <q-btn
        flat
        round
        icon="sym_r_arrow_back"
        @click="onClose"
        class="q-mr-md"
        aria-label="Go back"
      />
      <div class="text-h4 text-bold">Create New Event</div>
    </div>

    <EventFormComponent
      class="col"
      :group="preselectedGroup"
      :initial-date="route.query.date as string"
      @created="onEventCreated"
      @series-created="handleSeriesCreated"
      @close="onClose"
    />
  </q-page>
</template>

<script setup lang="ts">
import EventFormComponent from '../components/event/EventFormBasicComponent.vue'
import { useRouter, useRoute } from 'vue-router'
import { EventSeriesEntity } from '../types/event-series'
import { EventEntity, GroupEntity } from '../types'
import { ref, onMounted } from 'vue'
import { groupsApi } from '../api/groups'
import { useMeta } from 'quasar'
import { useNavigation } from '../composables/useNavigation'

const router = useRouter()
const route = useRoute()
const { goBack } = useNavigation()
const preselectedGroup = ref<GroupEntity | undefined>()

useMeta({
  title: 'Create Event'
})

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
  if (series.templateEventSlug) {
    router.push({ name: 'EventPage', params: { slug: series.templateEventSlug } })
  } else if (series.events && series.events.length > 0) {
    const firstEvent = series.events[0]
    if (firstEvent.slug) {
      router.push({ name: 'EventPage', params: { slug: firstEvent.slug } })
    }
  } else {
    router.push({ name: 'HomePage' })
  }
}

// Handle when user closes/cancels the form
const onClose = () => {
  const redirect = route.query.redirect as string
  if (redirect) {
    router.push(redirect)
  } else {
    goBack({ name: 'HomePage' })
  }
}
</script>

<style scoped>
/* Mobile responsive improvements */
@media (max-width: 768px) {
  .q-page {
    padding: 16px !important;
  }

  .q-px-xl {
    padding-left: 16px !important;
    padding-right: 16px !important;
  }
}
</style>
