<template>
  <div class="c-group-events-page">
    <SpinnerComponent v-if="isLoading" />
    <div data-cy="group-events-page"
      v-if="!isLoading && group && hasPermission">
      <div class="row q-mb-md q-mt-lg">
        <q-btn-toggle v-model="viewMode" flat stretch toggle-color="primary" :options="[
          { label: 'List', value: 'list', icon: 'sym_r_list' },
          // { label: 'Calendar', value: 'calendar', icon: 'sym_r_event' }
        ]" />
      </div>

      <div class="row q-mb-md">
        <q-btn-toggle v-model="timeFilter" flat stretch toggle-color="primary" :options="[
          { label: 'Upcoming', value: 'upcoming' },
          { label: 'Past', value: 'past' }
        ]" />
      </div>

      <div v-if="viewMode === 'list'">
        <div v-if="filteredEvents?.length">
          <EventsItemComponent v-for="event in filteredEvents" :key="event.id" :event="event" layout="list"/>
        </div>
        <NoContentComponent v-else label="No events found" icon="sym_r_event_busy" />
      </div>

      <div v-else>
        <CalendarComponent mode="month" :day-height="100" :model-value="selectedDate" view="month"
          :selected-dates="calendarEvents" />
      </div>
    </div>
    <NoContentComponent data-cy="no-permission-group-events-page" v-if="!isLoading && group && !hasPermission" label="You don't have permission to see this page" icon="sym_r_group" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import CalendarComponent from '../../components/common/CalendarComponent.vue'
import SpinnerComponent from '../../components/common/SpinnerComponent.vue'
import { useRoute } from 'vue-router'
import { useGroupStore } from '../../stores/group-store'
import { GroupPermission } from '../../types'
import { useAuthStore } from '../../stores/auth-store'
import EventsItemComponent from '../../components/event/EventsItemComponent.vue'

const route = useRoute()
const isLoading = ref<boolean>(false)
const events = computed(() => useGroupStore().group?.events)

const viewMode = ref<'list' | 'calendar'>('list')
const timeFilter = ref<'upcoming' | 'past'>('upcoming')
const selectedDate = ref(null)
const group = computed(() => useGroupStore().group)

const hasPermission = computed(() => {
  return group.value && ((useGroupStore().getterIsPublicGroup || (useGroupStore().getterIsAuthenticatedGroup && useAuthStore().isAuthenticated)) ||
    useGroupStore().getterUserHasPermission(GroupPermission.SeeEvents))
})

onMounted(() => {
  if (hasPermission.value) {
    isLoading.value = true
    useGroupStore().actionGetGroupEvents(route.params.slug as string).finally(() => (isLoading.value = false))
  }
})

const filteredEvents = computed(() => {
  const now = new Date()
  const filtered = events.value?.filter(event => {
    const eventDate = new Date(event.startDate)
    return timeFilter.value === 'upcoming' ? eventDate >= now : eventDate < now
  }) || []

  // Sort events by date (ascending for upcoming, descending for past)
  return [...filtered].sort((a, b) => {
    const dateA = new Date(a.startDate).getTime()
    const dateB = new Date(b.startDate).getTime()
    return timeFilter.value === 'upcoming' ? dateA - dateB : dateB - dateA
  })
})

const calendarEvents = computed(() => {
  const data = events.value?.map(event => event.startDate)
  return data
})

</script>
