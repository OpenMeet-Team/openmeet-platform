<script setup lang="ts">
import { formatDate } from 'src/utils/dateUtils.ts'
import { EventEntity } from 'src/types'
import { useRoute, useRouter } from 'vue-router'

interface Props {
  events?: EventEntity[]
}

const route = useRoute()
const router = useRouter()

defineProps<Props>()
</script>

<template>
  <q-card class="shadow-0 q-mt-lg">
    <q-card-section>
      <div class="text-h5 row justify-between">Upcoming Events <span v-if="events?.length">({{ events.length }})</span> <q-btn v-if="events?.length" no-caps flat label="See all" :to="{ name: 'GroupEventsPage', params: { id: route.params.id }}"/></div>
    </q-card-section>
    <q-list v-if="events?.length">
      <q-item v-for="event in events" :key="event.id" clickable v-ripple>
        <q-item-section avatar>
          <q-icon name="sym_r_event" color="primary" size="md"/>
        </q-item-section>
        <q-item-section>
          <q-item-label>{{ event.name }}</q-item-label>
          <q-item-label caption>
            {{ formatDate(event.startDate) }}
          </q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-btn flat color="primary" label="Details"
                 @click="router.push({ name: 'EventPage', params: { id: event.id } })"/>
        </q-item-section>
      </q-item>
    </q-list>
    <NoContentComponent v-else icon="sym_r_event_busy" label="No upcoming events"/>
  </q-card>
</template>

<style scoped lang="scss">

</style>
