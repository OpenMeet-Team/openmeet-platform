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
    <q-separator class="q-my-lg" />
    <EventsListComponent :events="events"
    layout="list"
    />
  </template>
</template>

<style scoped lang="scss"></style>
