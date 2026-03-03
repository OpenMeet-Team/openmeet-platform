<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const sorts = ref([
  { label: 'Most Members', value: 'members' },
  { label: 'Newest', value: 'newest' },
  { label: 'Name (A-Z)', value: 'name' }
])

const selectedSort = ref<string>(route.query.sort as string || 'members')

watch(() => route.query.sort, (newSort) => {
  selectedSort.value = (newSort as string) || 'members'
})

const onSortChange = (sort: string) => {
  selectedSort.value = sort
  router.push({
    path: route.path,
    query: {
      ...route.query,
      sort: sort === 'members' ? undefined : sort,
      page: 1
    }
  })
}
</script>

<template>
  <q-select
    data-cy="groups-sort"
    :model-value="selectedSort"
    :options="sorts"
    label="Sort by"
    outlined
    emit-value
    map-options
    filled
    style="min-width: 160px;"
    @update:model-value="onSortChange"
  />
</template>
