<template>
  <q-page
    padding
    style="max-width: 1024px"
    class="q-mx-auto"
    data-cy="events-page"
  >
    <div class="row justify-between items-center q-mb-md">
      <div class="text-h4">
        <span class="text-bold q-mr-xs">Events list</span>
      </div>
    </div>

    <!-- Collapsible Filters Section -->
    <q-expansion-item
      :model-value="showFilters"
      @update:model-value="showFilters = $event"
      header-class="text-h6 q-py-md"
      class="q-mb-md"
    >
      <template v-slot:header>
        <q-item-section avatar>
          <q-icon name="sym_r_tune" />
        </q-item-section>
        <q-item-section>
          <q-item-label class="text-h6">{{ filterLabel }}</q-item-label>
          <q-item-label caption v-if="activeFiltersCount > 0">
            {{ activeFiltersCount }} filter{{ activeFiltersCount > 1 ? 's' : '' }} applied
          </q-item-label>
        </q-item-section>
        <q-item-section side v-if="hasActiveFilters">
          <q-btn
            flat
            dense
            round
            icon="sym_r_clear_all"
            @click.stop="clearAllFilters"
            color="negative"
            size="sm"
          >
            <q-tooltip>Clear all filters</q-tooltip>
          </q-btn>
        </q-item-section>
      </template>

      <div class="row q-col-gutter-md q-pb-md">
        <!-- First row: Date, Type, Categories -->
        <div class="col-12 col-sm-6 col-md-3">
          <EventsDateFilterComponent />
        </div>
        <div class="col-12 col-sm-6 col-md-3">
          <EventsTypeFilterComponent />
        </div>
        <div class="col-12 col-sm-6 col-md-3">
          <EventsCategoriesFilterComponent />
        </div>
        <!-- Empty space for alignment -->
        <div class="col-12 col-sm-6 col-md-3"></div>

        <!-- Second row: Location and Radius -->
        <div class="col-12 col-sm-8 col-md-6">
          <EventsLocationFilterComponent />
        </div>
        <div class="col-12 col-sm-4 col-md-2">
          <RadiusFilterComponent />
        </div>
      </div>
    </q-expansion-item>

    <EventsListComponent
      :events="events?.data"
      :loading="useEventsStore().isLoading"
      :show-pagination="true"
      :current-page="currentPage"
      :total-pages="events?.totalPages"
      layout="list"
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
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { LoadingBar, useMeta } from 'quasar'
import { useRoute, useRouter } from 'vue-router'
import NoContentComponent from '../components/global/NoContentComponent.vue'
import EventsDateFilterComponent from '../components/events/EventsDateFilterComponent.vue'
import EventsTypeFilterComponent from '../components/events/EventsTypeFilterComponent.vue'
import EventsCategoriesFilterComponent from '../components/common/CategoriesFilterComponent.vue'
import { useEventsStore } from '../stores/events-store'
import EventsLocationFilterComponent from '../components/common/LocationFilterComponent.vue'
import RadiusFilterComponent from '../components/common/RadiusFilterComponent.vue'
import EventsListComponent from '../components/event/EventsListComponent.vue'

const route = useRoute()
const router = useRouter()
const eventsStore = useEventsStore()

// Filters state
const showFilters = ref(false)

// Pagination
const currentPage = ref(parseInt(route.query.page as string) || 1)

const events = computed(() => useEventsStore().events)

// Filter state helpers
const hasActiveFilters = computed(() => {
  return !!(route.query.categories ||
           route.query.location ||
           route.query.range ||
           route.query.type ||
           route.query.radius)
})

const activeFiltersCount = computed(() => {
  let count = 0
  if (route.query.categories) count++
  if (route.query.location) count++
  if (route.query.range) count++
  if (route.query.type) count++
  if (route.query.radius) count++
  return count
})

const filterLabel = computed(() => {
  return showFilters.value ? 'Filters' : 'Show Filters'
})

const clearAllFilters = () => {
  router.push({ path: route.path })
}

// Auto-open filters if any are active
watch(() => hasActiveFilters.value, (newVal) => {
  if (newVal) {
    showFilters.value = true
  }
}, { immediate: true })

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
  async (newQuery, oldQuery) => {
    // Only fetch if the queries are actually different
    if (JSON.stringify(newQuery) !== JSON.stringify(oldQuery)) {
      currentPage.value = parseInt(newQuery.page as string) || 1
      LoadingBar.start()
      fetchEvents().finally(LoadingBar.stop)
    }
  },
  { immediate: true, deep: true }
)

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
