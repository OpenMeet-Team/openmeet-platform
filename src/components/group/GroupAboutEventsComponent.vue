<script setup lang="ts">
import { formatDate } from '../../utils/dateUtils'
import { EventEntity } from '../../types'
import { useNavigation } from '../../composables/useNavigation'
import SubtitleComponent from '../common/SubtitleComponent.vue'
import NoContentComponent from '../global/NoContentComponent.vue'
import { computed } from 'vue'

const { navigateToEvent } = useNavigation()
interface Props {
  events?: EventEntity[]
}

const props = defineProps<Props>()

// Sort events by start date
const sortedEvents = computed(() => {
  if (!props.events?.length) return []
  return [...props.events].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
})
</script>

<template>
  <SubtitleComponent class="q-px-md q-mt-lg" label="Upcoming Events" :to="{ name: 'GroupEventsPage' }" />

  <q-card flat>
    <q-list v-if="sortedEvents?.length">
      <q-item
        v-for="event in sortedEvents"
        :key="event.id"
        clickable
        @click="navigateToEvent(event)"
        class="shadow-1 q-mt-md"
      >
        <q-item-section avatar>
          <q-icon name="sym_r_event" color="primary" size="md" />
        </q-item-section>
        <q-item-section>
          <q-item-label>
            {{ event.name }}
            <q-badge v-if="event.status === 'cancelled'" color="red" class="q-ml-sm">
              <q-icon name="sym_r_cancel" size="xs" class="q-mr-xs" />
              Cancelled
            </q-badge>
          </q-item-label>
          <q-item-label caption>
            {{ formatDate(event.startDate) }}
          </q-item-label>
        </q-item-section>
      </q-item>
    </q-list>
    <NoContentComponent v-else icon="sym_r_event_busy" label="No upcoming events" />
  </q-card>
</template>

<style scoped lang="scss"></style>
