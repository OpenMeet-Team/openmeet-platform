<template>
  <q-page
    padding
    style="max-width: 1024px"
    class="q-mx-auto"
    data-cy="events-page"
  >
    <div class="row text-h4">
      <span class="text-bold q-mr-xs">Events list</span>
    </div>

    <div class="row q-col-gutter-md q-mb-lg q-mt-md">
      <EventsDateFilterComponent />
      <EventsTypeFilterComponent />
      <EventsCategoriesFilterComponent />
      <EventsLocationFilterComponent />
      <RadiusFilterComponent />
      <div
        class="row items-center"
        v-if="
          route.query.categories ||
          route.query.location ||
          route.query.range ||
          route.query.type ||
          route.query.radius
        "
      >
        <q-btn
          no-caps
          size="md"
          flat
          label="Reset filters"
          @click="router.push({ path: '' })"
        />
      </div>
    </div>

    <EventsListComponent
      :events="events?.data"
      :loading="useEventsStore().isLoading"
      :show-pagination="true"
      :current-page="currentPage"
      :total-pages="events?.totalPages"
      layout="grid"
      @page-change="onPageChange"
      label=""
    >
      <template #empty>
        <NoContentComponent
          label="No events found matching your criteria"
          icon="sym_r_search_off"
        />
      </template>
    </EventsListComponent>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch, onBeforeUnmount } from 'vue'
import { LoadingBar, useMeta } from 'quasar'
import { useRoute, useRouter } from 'vue-router'
import NoContentComponent from 'components/global/NoContentComponent.vue'
import EventsDateFilterComponent from 'components/events/EventsDateFilterComponent.vue'
import EventsTypeFilterComponent from 'components/events/EventsTypeFilterComponent.vue'
import EventsCategoriesFilterComponent from 'components/common/CategoriesFilterComponent.vue'
import { useEventsStore } from 'stores/events-store.ts'
import EventsLocationFilterComponent from 'components/common/LocationFilterComponent.vue'
import RadiusFilterComponent from 'components/common/RadiusFilterComponent.vue'
import EventsListComponent from 'components/event/EventsListComponent.vue'

const route = useRoute()
const router = useRouter()
const eventsStore = useEventsStore()

// Pagination
const currentPage = ref(parseInt(route.query.page as string) || 1)

const events = computed(() => useEventsStore().events)

useMeta({
  title: 'Events'
})

// Fetch events based on the query parameters
const fetchEvents = async () => {
  try {
    LoadingBar.start()
    await eventsStore.actionGetEvents(route.query)
  } catch (error) {
    console.error('Error fetching events:', error)
  } finally {
    LoadingBar.stop()
  }
}

// Refetch events when query parameters change
watch(
  () => route.query,
  async () => {
    currentPage.value = parseInt(route.query.page as string) || 1
    LoadingBar.start()
    fetchEvents().finally(LoadingBar.stop)
  },
  { immediate: true }
)

// Remove the separate LoadingBar calls in onMounted
onMounted(() => {
  fetchEvents()
})

onBeforeUnmount(() => {
  LoadingBar.stop() // Ensure loading bar is stopped when component unmounts
  eventsStore.$reset()
})

// Handle pagination changes and update the URL
const onPageChange = (page: number) => {
  router.push({
    query: {
      ...route.query,
      page: page.toString() // Ensure page is converted to string
    }
  })
}
</script>

<style scoped></style>
