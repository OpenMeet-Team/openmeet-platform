<script setup lang="ts">
import { formatDate } from 'src/utils/dateUtils.ts'
import { EventEntity } from 'src/types'
import { useNavigation } from '../../composables/useNavigation.ts'
import SubtitleComponent from '../common/SubtitleComponent.vue'

const { navigateToEvent } = useNavigation()
interface Props {
  events?: EventEntity[]
}

defineProps<Props>()
</script>

<template>
  <SubtitleComponent class="q-px-md q-mt-lg" label="Upcoming Events" :to="{ name: 'GroupEventsPage' }" />

  <q-card flat>
    <q-list v-if="events?.length">
      <q-item v-ripple="false" class="shadow-1 q-mt-md" v-for="event in events" :key="event.id" clickable>
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
            @click="navigateToEvent(event)" />
        </q-item-section>
      </q-item>
    </q-list>
    <NoContentComponent v-else icon="sym_r_event_busy" label="No upcoming events" />
  </q-card>
</template>

<style scoped lang="scss"></style>
