<template>
  <div class="c-group-events-page">
    <SpinnerComponent v-if="isLoading" />
    <div data-cy="group-events-page"
      v-if="hasPermission">
      <div class="row q-mb-md">
        <q-btn-toggle v-model="viewMode" flat stretch toggle-color="primary" :options="[
          { label: 'List', value: 'list', icon: 'sym_r_list' },
          { label: 'Calendar', value: 'calendar', icon: 'sym_r_event' }
        ]" />
      </div>

      <div class="row q-mb-md">
        <q-btn-toggle v-model="timeFilter" flat stretch toggle-color="primary" :options="[
          { label: 'Upcoming', value: 'upcoming' },
          { label: 'Past', value: 'past' }
        ]" />
      </div>

      <div v-if="viewMode === 'list'">
        <q-list bordered separator v-if="filteredEvents?.length">
          <q-item v-for="event in filteredEvents" :key="event.id" class="q-my-sm">
            <q-item-section>
              <q-item-label class="text-primary">{{ formatDate(event.startDate) }}</q-item-label>
              <q-item-label class="text-h6">{{ event.name }}</q-item-label>
              <q-item-label caption>{{ event.type }}</q-item-label>
              <q-item-label caption>{{ event.description }}</q-item-label>
              <div class="row items-center q-gutter-sm">
                <q-icon name="sym_r_people" size="sm" />
                <span>{{ event.attendeesCount }} {{ event.attendeesCount === 1 ? 'attendee' : 'attendees' }}</span>
              </div>
            </q-item-section>
            <q-item-section side>
              <q-btn color="primary" label="Attend" @click="navigateToEvent(event)" />
            </q-item-section>
          </q-item>
        </q-list>
        <NoContentComponent v-else label="No events found" icon="sym_r_event_busy" />
      </div>

      <div v-else>
        <CalendarComponent mode="month" :day-height="100" :model-value="selectedDate" view="month"
          :events="calendarEvents" />
      </div>
    </div>
    <NoContentComponent data-cy="no-permission-group-events-page" v-if="!hasPermission && !isLoading" label="You don't have permission to see this page" icon="sym_r_group" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { date } from 'quasar'
import CalendarComponent from 'components/common/CalendarComponent.vue'
import SpinnerComponent from 'components/common/SpinnerComponent.vue'
import { useRoute } from 'vue-router'
import { useNavigation } from 'src/composables/useNavigation.ts'
import { useGroupStore } from 'src/stores/group-store'
import { GroupPermission } from 'src/types'
import { useAuthStore } from 'src/stores/auth-store'

const { navigateToEvent } = useNavigation()

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
  return events.value?.filter(event => {
    const eventDate = new Date(event.startDate)
    return timeFilter.value === 'upcoming' ? eventDate >= now : eventDate < now
  })
})

const calendarEvents = computed(() => {
  return events.value?.map(event => ({
    title: event.name,
    date: event.startDate,
    bgcolor: 'primary'
  }))
})

const formatDate = (dateString: string) => {
  return date.formatDate(dateString, 'ddd, MMM D, YYYY, h:mm A')
}

</script>
