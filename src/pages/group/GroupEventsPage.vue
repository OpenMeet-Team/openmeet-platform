<template>
  <div class="q-pa-md">
    <SpinnerComponent v-if="isLoading"/>
    <div class="row q-mb-md">
      <q-btn-toggle
        v-model="viewMode"
        flat
        stretch
        toggle-color="primary"
        :options="[
          {label: 'List', value: 'list', icon: 'sym_r_list'},
          {label: 'Calendar', value: 'calendar', icon: 'sym_r_event'}
        ]"
      />
    </div>

    <div class="row q-mb-md">
      <q-btn-toggle
        v-model="timeFilter"
        flat
        stretch
        toggle-color="primary"
        :options="[
          {label: 'Upcoming', value: 'upcoming'},
          {label: 'Past', value: 'past'}
        ]"
      />
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
            <q-btn color="primary" label="Attend" @click="navigateToEvent(event.slug, event.id)" />
          </q-item-section>
        </q-item>
      </q-list>
      <NoContentComponent v-else label="No events found" icon="sym_r_event_busy"/>
    </div>

    <div v-else>
      <CalendarComponent
        mode="month"
        :day-height="100"
        :model-value="selectedDate"
        view="month"
        :events="calendarEvents"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { date } from 'quasar'
import CalendarComponent from 'components/common/CalendarComponent.vue'
import SpinnerComponent from 'components/common/SpinnerComponent.vue'
import { decodeLowercaseStringToNumber } from 'src/utils/encoder.ts'
import { useRoute } from 'vue-router'
import { useNavigation } from 'src/composables/useNavigation.ts'
import { useGroupStore } from 'src/stores/group-store'

const { navigateToEvent } = useNavigation()

const route = useRoute()
const isLoading = ref<boolean>(false)
const events = computed(() => useGroupStore().group?.events)

const viewMode = ref<'list' | 'calendar'>('list')
const timeFilter = ref<'upcoming' | 'past'>('upcoming')
const selectedDate = ref(null)

onMounted(() => {
  isLoading.value = true
  const groupId = decodeLowercaseStringToNumber(route.params.id as string)

  useGroupStore().actionGetGroupEvents(String(groupId)).finally(() => (isLoading.value = false))
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
