<template>
  <q-page padding style="max-width: 1024px" class="q-mx-auto">

    <div class="row text-h4">
      <span class="text-bold q-mr-xs">Events list</span>/
      <router-link class="q-ml-xs router-link-inherit" active-class="text-bold" :to="{ name: 'GroupsPage' }">Groups list</router-link>
    </div>

    <div class="row q-col-gutter-md q-mb-lg q-mt-md">
      <EventsDateFilterComponent/>
      <EventsTypeFilterComponent/>
      <EventsCategoriesFilterComponent/>
      <EventsLocationFilterComponent/>
      <div class="row items-center" v-if="route.query.categories || route.query.location || route.query.range || route.query.type">
        <q-btn no-caps size="md" flat label="Reset filters" @click="router.push({ path: ''})"/>
      </div>
    </div>

    <template v-if="events">

        <!-- Show loader if loading, else show content -->
        <SpinnerComponent v-if="useEventsStore().isLoading"/>

        <!-- Event List -->
        <div v-else-if="events">
          <div v-if="events.data?.length">
            <div  v-for="event in events.data" :key="event.id" class="col-12 col-sm-6 col-md-4">
            <EventsItemComponent :event="event"/>
          </div>
          </div>

          <!-- No content if no events and not loading -->
          <NoContentComponent v-else label="No events found matching your criteria" icon="sym_r_search_off"/>
      </div>

      <!-- Pagination -->
      <q-pagination v-if="!useEventsStore().isLoading && events && events.totalPages && events.totalPages > 1"
                    v-model="currentPage"
                    :max="events.totalPages"
                    @input="onPageChange"
      />
    </template>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch, onBeforeUnmount } from 'vue'
import EventsItemComponent from 'components/event/EventsItemComponent.vue'
import SpinnerComponent from 'components/common/SpinnerComponent.vue'
import { LoadingBar, useMeta } from 'quasar'
import { useRoute, useRouter } from 'vue-router'
import NoContentComponent from 'components/global/NoContentComponent.vue'
import EventsDateFilterComponent from 'components/events/EventsDateFilterComponent.vue'
import EventsTypeFilterComponent from 'components/events/EventsTypeFilterComponent.vue'
import EventsCategoriesFilterComponent from 'components/common/CategoriesFilterComponent.vue'
import { useEventsStore } from 'stores/events-store.ts'
import EventsLocationFilterComponent from 'components/common/LocationFilterComponent.vue'

const route = useRoute()
const router = useRouter()

// Pagination
const currentPage = ref(parseInt(route.query.page as string) || 1)

const events = computed(() => useEventsStore().events)

useMeta({
  title: 'Events'
})

// Fetch categories and events when the component is mounted
onMounted(() => {
  LoadingBar.start()
  useEventsStore().actionGetEventsState(route.query).finally(LoadingBar.stop)
})

onBeforeUnmount(() => {
  // Cleanup store state when the component unmounts
  useEventsStore().$reset()
})

// Fetch events based on the query parameters
const fetchEvents = async () => {
  LoadingBar.start()
  useEventsStore().actionGetEvents(route.query).finally(LoadingBar.stop)
}

// Refetch events when query parameters (category, location, page) change
watch(() => route.query, fetchEvents)

// Handle pagination changes and update the URL
const onPageChange = (page: number) => {
  router.push({ query: { ...route.query, page } })
}

</script>

<style scoped>

</style>
