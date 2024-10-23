<script setup lang="ts">
import { EventEntity } from 'src/types'
import { getImageSrc } from 'src/utils/imageUtils.ts'
import { formatDate } from '../../utils/dateUtils.ts'
import { useNavigation } from 'src/composables/useNavigation.ts'

interface Props {
  event: EventEntity
}
defineProps<Props>()

const { navigateToEvent, navigateToGroup } = useNavigation()
</script>

<template>
  <div class="row q-mb-xl q-gutter-md">
    <q-img class="cursor-pointer rounded-borders" style="max-width: 300px; height: 150px;"
      @click="navigateToEvent(event.slug, event.id)" ratio="16/9" :src="getImageSrc(event.image)">
      <div class="q-pa-none absolute q-ml-sm no-padding bg-transparent"><q-badge>{{ event.type }}</q-badge></div>
    </q-img>
    <div class="col column">
      <div class="text-h6 text-bold q-pa-none cursor-pointer elipsys" @click="navigateToEvent(event.slug, event.id)">{{
        formatDate(event.startDate) }}
      </div>
      <div class="text-subtitle2 text-bold cursor-pointer" @click="navigateToEvent(event.slug, event.id)">{{ event.name }}</div>
      <div class="text-subtitle2">{{ event.location }}</div>
      <div class="text-h5 cursor-pointer" v-if="event.group" @click="navigateToGroup(event.group.slug, event.group.id)">
        {{ event.group.name }}
      </div>

      <q-space />
      <div class="q-mt-sm text-body2"><q-icon name="sym_r_people" size="sm" /> {{ event.attendeesCount }} <span
          v-if="event.maxAttendees">/ {{ event.maxAttendees }}</span> attendees</div>
    </div>
  </div>
</template>

<style scoped lang="scss"></style>
