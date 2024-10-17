<script setup lang="ts">
import { formatDate } from 'src/utils/dateUtils.ts'
import { EventEntity } from 'src/types'
import { useRoute } from 'vue-router'
import { useNavigation } from '../../composables/useNavigation.ts'

const { navigateToEvent } = useNavigation()
interface Props {
  events?: EventEntity[]
}

const route = useRoute()

defineProps<Props>()
</script>

<template>
  <q-card class="shadow-0 q-mt-lg">
    <q-card-section>
      <div class="text-h5 row justify-between items-center"><span>Upcoming Events <span v-if="events?.length">({{ events.length }})</span></span> <q-btn v-if="events?.length" padding="xs" no-caps flat label="See all" :to="{ name: 'GroupEventsPage', params: { id: route.params.id }}"/></div>
    </q-card-section>
    <q-list v-if="events?.length">
      <q-item class="shadow-1 q-mt-md" v-for="event in events" :key="event.id" clickable v-ripple>
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
          <q-btn no-caps outline size="md" color="primary" label="Attend"
                 @click="navigateToEvent(event.slug, event.id)"/>
        </q-item-section>
      </q-item>
    </q-list>
    <NoContentComponent v-else icon="sym_r_event_busy" label="No upcoming events"/>
  </q-card>
</template>

<style scoped lang="scss">

</style>
