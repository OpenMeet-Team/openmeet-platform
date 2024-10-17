<script setup lang="ts">

import { ref, watch } from 'vue'
import { EventType } from 'src/types'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const selectedType = ref<EventType | null>(route.query.type as EventType || null)
const types = ref([
  { label: 'Online', value: 'online' },
  { label: 'In Person', value: 'in-person' },
  { label: 'Hybrid', value: 'hybrid' }
])

// Watch for changes in query and update selectedType accordingly
watch(() => route.query.type, (newType) => {
  selectedType.value = newType as EventType || null
})

const onFilterByType = (type: string) => {
  selectedType.value = type as EventType

  if (type) {
    router.push({
      path: '',
      query: {
        ...route.query,
        type: selectedType.value,
        page: 1
      }
    })
  } else {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { type, ...rest } = route.query
    router.push({
      path: '',
      query: {
        ...rest,
        page: 1
      }
    })
  }
}

</script>

<template>
  <q-select
    :model-value="selectedType"
    :options="types"
    label="Any type"
    outlined
    emit-value
    map-options
    clearable
    filled
    :hide-dropdown-icon="!!selectedType"
    style="min-width: 150px;"
    @update:model-value="onFilterByType"
  />
</template>

<style scoped lang="scss">

</style>
