<script setup lang="ts">
import { EventEntity } from 'src/types'
import { onMounted, ref } from 'vue'
import { groupsApi } from 'src/api/groups.ts'
import SpinnerComponent from '../common/SpinnerComponent.vue'
import EventsItemComponent from '../event/EventsItemComponent.vue'
import SubtitleComponent from '../common/SubtitleComponent.vue'
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
    <SubtitleComponent data-cy="recommended-events-component" class="q-mt-md q-px-md" label="Similar Events"
      :to="{ name: 'EventsPage' }" />
    <div class="row q-col-gutter-md q-mt-lg">
      <EventsItemComponent class="col-12 col-md-6" :event="e" v-for="e in events" :key="e.id" />
    </div>
  </template>
</template>

<style scoped lang="scss"></style>
