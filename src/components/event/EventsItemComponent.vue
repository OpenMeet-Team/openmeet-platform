<script setup lang="ts">
import { EventEntity } from 'src/types'
import { getImageSrc } from 'src/utils/imageUtils.ts'
import { formatDate } from 'src/utils/dateUtils.ts'
import { useNavigation } from 'src/composables/useNavigation.ts'
import { pluralize } from 'src/utils/stringUtils.ts'

interface Props {
  event: EventEntity
}
defineProps<Props>()

const { navigateToEvent, navigateToGroup } = useNavigation()
</script>

<template>
  <div class="row q-mb-xl q-col-gutter-md" data-cy="events-item">
    <div class="col-12 col-sm-4">
        <q-img height="150px" class="cursor-pointer rounded-borders"
      @click="navigateToEvent(event)" ratio="16/9" :src="getImageSrc(event.image)">
      <div class="q-pa-none absolute q-ml-sm no-padding bg-transparent"><q-badge>{{ event.type }}</q-badge></div>
    </q-img>
    </div>
    <div class="col-12 col-sm-8 column">
      <div class="text-h6 text-bold q-pa-none cursor-pointer elipsys" @click="navigateToEvent(event)">
        {{ formatDate(event.startDate) }}
      </div>
      <div class="text-subtitle2 text-bold cursor-pointer" @click="navigateToEvent(event)">{{ event.name }}</div>
      <div class="text-subtitle2">{{ event.location }}</div>
      <div class="text-h5 cursor-pointer" v-if="event.group" @click="navigateToGroup(event.group)">
        {{ event.group.name }}
      </div>

      <q-space />
      <div class="q-mt-sm text-body2" v-if="event.attendeesCount"><q-icon name="sym_r_people" size="sm" /> {{ event.attendeesCount }} <span
          v-if="event.maxAttendees">/ {{ event.maxAttendees }}</span> {{ pluralize(event.attendeesCount as number, 'attendee', 'attendees') }}</div>
    </div>
  </div>
</template>

<style scoped lang="scss"></style>
