<template>
  <q-select
    v-model="radius"
    :options="radiusOptions"
    label="Any radius"
    clearable
    :outlined="true"
    filled
    :hide-dropdown-icon="!!radius"
    style="min-width: 200px;"
    data-cy="radius-filter"
    @update:model-value="onFilterByRadius"
    emit-value
    map-options
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const radius = ref<string>(route.query.radius as string || '')

const radiusOptions = [
  { label: '5 miles', value: '5' },
  { label: '10 miles', value: '10' },
  { label: '25 miles', value: '25' },
  { label: '50 miles', value: '50' },
  { label: '100 miles', value: '100' }
]

const onFilterByRadius = (value: string | null) => {
  console.log('Radius selected:', value)

  const query = { ...route.query }

  if (!value) {
    delete query.radius
    console.log('Clearing radius')
  } else {
    query.radius = value
    console.log('Setting radius to:', value)
  }

  delete query.page

  console.log('Final query:', query)
  router.push({ query })
}
</script>
