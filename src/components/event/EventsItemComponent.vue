<script setup lang="ts">
import { EventEntity } from 'src/types'
import { getImageSrc } from 'src/utils/imageUtils.ts'
import { formatDate } from '../../utils/dateUtils.ts'
import { truncateDescription } from '../../utils/stringUtils.ts'
import { useNavigation } from 'src/composables/useNavigation.ts'

interface Props {
  event: EventEntity
}
defineEmits(['view'])
defineProps<Props>()

const { navigateToEvent } = useNavigation()
</script>

<template>
  <q-card class="event-card">
    <q-img :src="getImageSrc(event.image)" basic>
      <div class="absolute-bottom text-subtitle2 text-center">
        {{ formatDate(event.startDate) }}
      </div>
    </q-img>

    <q-card-section>
      <div class="text-h6">{{ event.name }}</div>
      <div class="text-subtitle2">{{ event.location }}</div>
      <div class="text-subtitle2">{{ event.type }}</div>
    </q-card-section>

    <q-card-section class="q-pt-none" v-if="event.description">
      {{ truncateDescription(event.description) }}
    </q-card-section>

    <q-card-section class="text-subtitle2">
      <q-icon name="sym_r_people" /> {{ event.attendeesCount }} <span v-if="event.maxAttendees">/ {{ event.maxAttendees }}</span> attendees
    </q-card-section>

    <q-separator />

    <q-card-actions align="right">
<!--      <q-btn flat color="primary" label="View Details" @click="$emit('view', event.id)" />-->
      <q-btn flat color="primary" label="View Details" @click="navigateToEvent(event.slug, event.id)" />
    </q-card-actions>
  </q-card>
</template>

<style scoped lang="scss">

</style>
