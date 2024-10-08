<script setup lang="ts">
import { EventEntity } from 'src/types'
import { formatDate } from 'src/utils/dateUtils.ts'
interface Props {
  events: EventEntity[]
}
defineProps<Props>()
defineEmits(['view'])
</script>

<template>
  <q-item v-for="event in events" :key="event.id" clickable v-ripple @click="$emit('view', event.id)">
    <q-item-section avatar>
      <q-icon name="sym_r_event" color="primary" size="md"/>
    </q-item-section>
    <q-item-section>
      <q-item-label>{{ event.name }}</q-item-label>
      <q-item-label caption>
        {{ formatDate(event.startDate) }}
      </q-item-label>
      <q-item-label caption v-if="event.group">
        Organized by {{ event.group.name }}
      </q-item-label>
    </q-item-section>
  </q-item>
</template>

<style scoped lang="scss">

</style>
