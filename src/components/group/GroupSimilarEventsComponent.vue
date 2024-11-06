<script setup lang="ts">
import { EventEntity, GroupEntity } from 'src/types'
import { onMounted, ref } from 'vue'
import { groupsApi } from 'src/api/groups.ts'
import SpinnerComponent from '../common/SpinnerComponent.vue'
import EventsItemComponent from '../event/EventsItemComponent.vue'
import SubtitleComponent from '../common/SubtitleComponent.vue'

interface Props {
  group?: GroupEntity | null
}

const props = defineProps<Props>()
const events = ref<EventEntity[]>([])
const loaded = ref<boolean>(false)

onMounted(() => {
  groupsApi.similarEvents((String(props.group?.id || 0))).then(res => {
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
    <SubtitleComponent data-cy="recommended-events-component" class="q-mt-md q-px-md" label="Similar Events" :to="{ name: 'EventsPage' }" />
    <div class="row q-col-gutter-md q-mt-lg">
      <EventsItemComponent class="col-12 col-md-6" :event="e" v-for="e in events" :key="e.id" />
    </div>
  </template>
</template>

<style scoped lang="scss"></style>
