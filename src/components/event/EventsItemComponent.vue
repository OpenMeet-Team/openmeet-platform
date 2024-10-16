<script setup lang="ts">
import { EventEntity } from 'src/types'
import { getImageSrc } from 'src/utils/imageUtils.ts'
import { formatDate } from '../../utils/dateUtils.ts'
import { useNavigation } from 'src/composables/useNavigation.ts'

interface Props {
  event: EventEntity
}
defineEmits(['view'])
defineProps<Props>()

const { navigateToEvent, navigateToGroup } = useNavigation()
</script>

<template>
  <q-card class="event-card shadow-0 q-my-xl">
    <q-card-section horizontal>
      <q-img class="cursor-pointer" @click="navigateToEvent(event.slug, event.id)" style="max-width: 150px" :src="getImageSrc(event.image)">
        <div class="q-pa-none absolute q-ml-sm no-padding bg-transparent"><q-badge>{{ event.type }}</q-badge></div>
      </q-img>
      <q-card-actions vertical class="justify-around q-px-md">
        <div class="text-subtitle2 cursor-pointer" @click="navigateToEvent(event.slug, event.id)">{{ formatDate(event.startDate) }}</div>
        <div class="text-h6 cursor-pointer" @click="navigateToEvent(event.slug, event.id)">{{ event.name }}</div>
        <div class="text-h5 cursor-pointer" v-if="event.group" @click="navigateToGroup(event.group.slug, event.group.id)">{{ event.group.name }}</div>
        <div class="text-subtitle2">{{ event.location }}</div>
        <div class="q-mt-sm text-body2"><q-icon name="sym_r_people" /> {{ event.attendeesCount }} <span v-if="event.maxAttendees">/ {{ event.maxAttendees }}</span> attendees</div>
      </q-card-actions>
    </q-card-section>
  </q-card>
</template>

<style scoped lang="scss">

</style>
