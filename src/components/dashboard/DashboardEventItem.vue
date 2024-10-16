<template>
  <q-card class="event-card">
    <q-img :src="getImageSrc(event.image)" :ratio="16/9">
      <div class="absolute-bottom text-subtitle2 text-center bg-black-4 full-width">{{ event.name }}</div>
    </q-img>

    <q-card-section>
      <div class="text-h6">{{ event.name }}</div>
      <div class="text-subtitle2" v-if="event.startDate">
        <q-icon name="sym_r_event" size="xs" /> {{ formatDate(event.startDate) }} <span v-if="event.endDate">- {{ formatDate(event.endDate) }}</span>
      </div>
      <div class="text-subtitle2" v-if="event.location">
        <q-icon name="sym_r_location_on" size="xs" />{{ event.location }}
      </div>
    </q-card-section>

    <q-card-section class="q-pt-none" v-if="event.description">
      <div class="text-body2">{{ truncateDescription(event.description) }}</div>
    </q-card-section>

    <q-card-section class="q-pt-none">
      <div class="text-caption">
        <q-icon name="sym_r_people" size="xs" /> {{ event.attendeesCount }} <span v-if="event.maxAttendees">/ {{ event.maxAttendees }}</span> attendees
      </div>
      <div class="text-caption" v-if="event.group">
        <q-icon name="sym_r_groups" size="xs" /> Hosted by {{ event.group.name }}
      </div>
    </q-card-section>

    <q-separator />

    <q-card-actions align="right">
      <q-btn flat color="primary" label="Edit" @click="onEditEvent" />
      <q-btn flat color="primary" label="View" @click="viewEventDetails" />
      <q-btn flat :color="isAttending ? 'negative' : 'secondary'" :label="isAttending ? 'Cancel RSVP' : 'RSVP'" @click="toggleRSVP" />
      <q-btn flat color="negative" label="Delete" @click="onDeleteEvent" />
    </q-card-actions>
  </q-card>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { date } from 'quasar'
import { EventEntity } from 'src/types'
import { getImageSrc } from 'src/utils/imageUtils.ts'

const props = defineProps<{
  event: EventEntity;
}>()

// eslint-disable-next-line func-call-spacing
const emit = defineEmits<{
  (e: 'view', event: EventEntity): void;
  (e: 'edit', event: EventEntity): void;
  (e: 'delete', event: EventEntity): void;
  (e: 'toggle-rsvp', id: number, attending: boolean): void;
}>()

const isAttending = ref(false)

const formatDate = (dateString: string): string => {
  return date.formatDate(dateString, 'MMMM D, YYYY HH:mm')
}

const truncateDescription = (description: string, length: number = 100): string => {
  return description.length > length
    ? `${description.substring(0, length)}...`
    : description
}

const viewEventDetails = () => {
  emit('view', props.event)
}

const onEditEvent = () => {
  emit('edit', props.event)
}

const onDeleteEvent = () => {
  emit('delete', props.event)
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
