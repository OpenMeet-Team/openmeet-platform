<template>
  <q-card class="event-card">
    <q-img :src="event.imageUrl" :ratio="16/9">
      <div class="absolute-bottom text-subtitle2 text-center bg-black-4 full-width">
        {{ event.title }}
      </div>
    </q-img>

    <q-card-section>
      <div class="text-h6">{{ event.title }}</div>
      <div class="text-subtitle2">
        <q-icon name="sym_r_event" size="xs" /> {{ formatDate(event.date) }} at {{ event.time }}
      </div>
      <div class="text-subtitle2">
        <q-icon name="sym_r_location_on" size="xs" /> {{ event.location }}
      </div>
    </q-card-section>

    <q-card-section class="q-pt-none">
      <div class="text-body2">{{ truncateDescription(event.description) }}</div>
    </q-card-section>

    <q-card-section class="q-pt-none">
      <div class="text-caption">
        <q-icon name="sym_r_people" size="xs" /> {{ event.attendees }} / {{ event.maxAttendees }} attendees
      </div>
      <div class="text-caption">
        <q-icon name="sym_r_groups" size="xs" /> Hosted by {{ event.hostingGroup }}
      </div>
    </q-card-section>

    <q-separator />

    <q-card-actions align="right">
      <q-btn flat color="primary" label="View Details" @click="viewEventDetails" />
      <q-btn flat :color="isAttending ? 'negative' : 'secondary'" :label="isAttending ? 'Cancel RSVP' : 'RSVP'" @click="toggleRSVP" />
    </q-card-actions>
  </q-card>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { date } from 'quasar'
import { Event } from 'components/models.ts'

const props = defineProps<{
  event: Event;
}>()

// eslint-disable-next-line func-call-spacing
const emit = defineEmits<{
  (e: 'view-details', id: number): void;
  (e: 'toggle-rsvp', id: number, attending: boolean): void;
}>()

const isAttending = ref(false)

const formatDate = (dateString: string): string => {
  return date.formatDate(dateString, 'MMMM D, YYYY')
}

const truncateDescription = (description: string, length: number = 100): string => {
  return description.length > length
    ? `${description.substring(0, length)}...`
    : description
}

const viewEventDetails = () => {
  emit('view-details', props.event.id)
}

const toggleRSVP = () => {
  isAttending.value = !isAttending.value
  emit('toggle-rsvp', props.event.id, isAttending.value)
}

</script>

<style scoped>
.event-card {
  width: 100%;
  max-width: 400px;
  transition: all 0.3s ease;
}

.event-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 4px 25px 0 rgba(0, 0, 0, 0.1);
}
</style>
