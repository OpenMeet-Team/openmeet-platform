<template>
  <q-page class="q-pa-md">
    <h1 class="text-h4 q-mb-md">Upcoming Events</h1>
    <div class="row q-col-gutter-md">
      <div v-for="event in events" :key="event.id" class="col-12 col-sm-6 col-md-4">
        <EventsItemComponent :event="event" @view="viewEventDetails"/>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { LoadingBar } from 'quasar'
import { useRouter } from 'vue-router'
import { eventsApi } from 'src/api/events.ts'
import { EventEntity } from 'src/types'
import EventsItemComponent from 'components/event/EventsItemComponent.vue'

const router = useRouter()

const events = ref<EventEntity[]>([])

const viewEventDetails = (eventId: number) => {
  router.push({ name: 'EventPage', params: { id: eventId } })
}

onMounted(() => {
  LoadingBar.start()
  eventsApi.getAll().finally(LoadingBar.stop).then(res => {
    events.value = res.data.data
  })
})
</script>

<style scoped>
.event-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.event-card .q-card__section:nth-last-child(2) {
  flex-grow: 1;
}
</style>
