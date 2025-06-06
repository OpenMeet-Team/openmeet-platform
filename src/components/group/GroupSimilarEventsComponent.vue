<script setup lang="ts">
import { EventEntity } from '../../types'
import { onMounted, ref } from 'vue'
import { groupsApi } from '../../api/groups'
import SpinnerComponent from '../common/SpinnerComponent.vue'
import EventsListComponent from '../event/EventsListComponent.vue'
import { useRoute } from 'vue-router'

const events = ref<EventEntity[]>([])
const loaded = ref<boolean>(false)
const route = useRoute()

onMounted(() => {
  if (route.params.slug) {
    groupsApi.similarEvents(String(route.params.slug)).then(res => {
      events.value = res.data
    }).finally(() => {
      loaded.value = true
    })
  }
})
</script>

<template>
  <SpinnerComponent v-if="!loaded" />
  <template v-if="loaded">
    <div class="q-mt-xl q-pt-xl events-container">
      <q-separator class="q-my-lg" />
      <EventsListComponent data-cy="recommended-events-component" :events="events"
      layout="list"
      />
    </div>
  </template>
</template>

<style scoped lang="scss">
.events-container {
  position: static !important;
  display: block !important;
  clear: both !important;
  float: none !important;
  z-index: auto !important;
}
</style>
