<script setup lang="ts">
import { EventEntity } from 'src/types'
import { onMounted, ref } from 'vue'
import { eventsApi } from 'src/api/events.ts'
import SpinnerComponent from '../common/SpinnerComponent.vue'
import EventsItemComponent from './EventsItemComponent.vue'
import SubtitleComponent from '../common/SubtitleComponent.vue'

interface Props {
  event: EventEntity
}

const props = defineProps<Props>()
const events = ref<EventEntity[]>([])
const loaded = ref<boolean>(false)

onMounted(() => {
  eventsApi.similarEvents(String(props.event.id)).then(res => {
    events.value = res.data
  }).finally(() => {
    loaded.value = true
  })
})
</script>

<template>
  <SpinnerComponent v-if="!loaded" />
  <template v-if="loaded">
    <q-separator class="q-my-lg" />
    <SubtitleComponent class="q-mt-md q-px-md" label="Similar Events" :to="{ name: 'EventsPage' }" />
    <div class="row">
      <EventsItemComponent class="col-12 col-lg-6" :event="e" v-for="e in events" :key="e.id" />
    </div>
  </template>
</template>

<style scoped lang="scss"></style>
