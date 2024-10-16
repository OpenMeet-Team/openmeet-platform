<script setup lang="ts">

import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { LoadingBar } from 'quasar'
import { categoriesApi } from 'src/api/categories.ts'
import { CategoryEntity } from 'src/types'

const route = useRoute()
const router = useRouter()
const categories = ref<CategoryEntity[]>([])
const selectedCategories = ref<number[] | []>(Array.isArray(route.query.categories) ? route.query.categories.map(Number) : route.query.categories ? [Number(route.query.categories)] : [])

// Handle filtering by categories (multiple) and update the URL
const onFilterByCategories = (categoryIds: number[]) => {
  selectedCategories.value = categoryIds ?? []

  router.push({
    path: '',
    query: {
      ...route.query,
      categories: categoryIds ?? undefined,
      page: 1
    }
  })
}

onMounted(() => {
  LoadingBar.start()
  categoriesApi.getAll().then(e => {
    categories.value = e.data
  }).finally(LoadingBar.stop)
})

</script>

<template>
  <q-select
    :model-value="selectedCategories"
    :options="categories"
    label="Any category"
    outlined
    emit-value
    map-options
    multiple
    clearable
    option-value="id"
    option-label="name"
    filled
    :hide-dropdown-icon="!!selectedCategories.length"
    style="min-width: 180px;"
    @update:model-value="onFilterByCategories"
  />
</template>

<style scoped lang="scss">

</style>
