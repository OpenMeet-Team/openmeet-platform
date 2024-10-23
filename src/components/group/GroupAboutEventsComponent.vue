<script setup lang="ts">
import { formatDate } from 'src/utils/dateUtils.ts'
import { EventEntity } from 'src/types'
import { useRoute } from 'vue-router'
import { useNavigation } from '../../composables/useNavigation.ts'
import SubtitleComponent from '../common/SubtitleComponent.vue'

const { navigateToEvent } = useNavigation()
interface Props {
  events?: EventEntity[]
}

const route = useRoute()

defineProps<Props>()
</script>

<template>
  <q-card class="shadow-0 q-mt-lg">
    <SubtitleComponent label="Upcoming Events" :to="{ name: 'GroupEventsPage', params: { id: route.params.id } }" />
    <q-list v-if="events?.length">
      <q-item class="shadow-1 q-mt-md" v-for="event in events" :key="event.id" clickable v-ripple>
        <q-item-section avatar>
          <q-icon name="sym_r_event" color="primary" size="md" />
        </q-item-section>
        <q-item-section>
          <q-item-label>{{ event.name }}</q-item-label>
          <q-item-label caption>
            {{ formatDate(event.startDate) }}
          </q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-btn no-caps outline size="md" color="primary" label="Attend"
            @click="navigateToEvent(event.slug, event.id)" />
        </q-item-section>
      </q-item>
    </q-list>
    <NoContentComponent v-else icon="sym_r_event_busy" label="No upcoming events" />
  </q-card>
</template>

<style scoped lang="scss"></style>
