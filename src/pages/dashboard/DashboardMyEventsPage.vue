<template>
  <q-page padding style="max-width: 1024px" class="q-mx-auto q-pb-xl">
    <div class="row justify-between items-start q-mb-md">
      <DashboardTitle defaultBack label="My Events" />
      <q-btn
        no-caps
        color="primary"
        icon="sym_r_add"
        label="Create Event"
        @click="onAddNewEvent"
      />
    </div>

    <!-- Tabs for Hosting / Attending / Past -->
    <q-tabs
      v-model="activeTab"
      class="text-grey-7 q-mb-lg"
      active-color="primary"
      indicator-color="primary"
      align="left"
      narrow-indicator
    >
      <q-tab name="hosting" label="Hosting" no-caps />
      <q-tab name="attending" label="Attending" no-caps />
      <q-tab name="past" label="Past" no-caps />
    </q-tabs>

    <SpinnerComponent v-if="isLoading" />

    <template v-if="!isLoading">
      <!-- No events state -->
      <NoContentComponent
        v-if="events.length === 0"
        @click="activeTab === 'hosting' ? onAddNewEvent() : exploreEvents()"
        :buttonLabel="activeTab === 'hosting' ? 'Create an Event' : 'Explore Events'"
        :label="getEmptyStateLabel()"
        icon="sym_r_event"
      />

      <!-- Events list -->
      <template v-else>
        <div class="q-mb-lg">
          <EventsItemComponent
            v-for="event in events"
            :key="event.id"
            :event="event"
            layout="list"
          />
        </div>

        <!-- Pagination -->
        <div v-if="totalPages > 1" class="flex justify-center q-mt-lg">
          <q-pagination
            v-model="currentPage"
            :max="totalPages"
            :max-pages="7"
            direction-links
            boundary-links
            @update:model-value="onPageChange"
          />
        </div>
      </template>
    </template>
  </q-page>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { LoadingBar, useMeta } from 'quasar'
import { eventsApi } from '../../api/events'
import { EventEntity } from '../../types'
import SpinnerComponent from '../../components/common/SpinnerComponent.vue'
import DashboardTitle from '../../components/dashboard/DashboardTitle.vue'
import EventsItemComponent from '../../components/event/EventsItemComponent.vue'
import NoContentComponent from '../../components/global/NoContentComponent.vue'

type EventTab = 'hosting' | 'attending' | 'past'

const route = useRoute()
const router = useRouter()
const isLoading = ref(false)
const events = ref<EventEntity[]>([])
const currentPage = ref(1)
const totalPages = ref(1)
const total = ref(0)
const limit = 10

// Get initial tab from query param or default to 'hosting'
const activeTab = ref<EventTab>(
  (route.query.tab as EventTab) || 'hosting'
)

useMeta({
  title: 'My Events'
})

const getEmptyStateLabel = () => {
  switch (activeTab.value) {
    case 'hosting':
      return 'You don\'t have any events you\'re hosting.'
    case 'attending':
      return 'You haven\'t RSVPed to any events yet.'
    case 'past':
      return 'No past events to show.'
    default:
      return 'No events to show.'
  }
}

const fetchEvents = async () => {
  isLoading.value = true
  LoadingBar.start()

  try {
    const res = await eventsApi.getDashboardEventsPaginated({
      page: currentPage.value,
      limit,
      tab: activeTab.value
    })
    events.value = res.data.data
    totalPages.value = res.data.totalPages
    total.value = res.data.total
  } finally {
    isLoading.value = false
    LoadingBar.stop()
  }
}

onMounted(() => {
  fetchEvents()
})

// Watch for tab changes
watch(activeTab, () => {
  currentPage.value = 1
  router.replace({ query: { tab: activeTab.value } })
  fetchEvents()
})

const onPageChange = () => {
  fetchEvents()
}

const onAddNewEvent = () => {
  router.push({ name: 'DashboardEventCreatePage' })
}

const exploreEvents = () => {
  router.push({ name: 'EventsPage' })
}
</script>
