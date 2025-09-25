<script setup lang="ts">

import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { LoadingBar } from 'quasar'
import { categoriesApi } from '../../api/categories'
import { CategoryEntity } from '../../types'

const route = useRoute()
const router = useRouter()
const categories = ref<CategoryEntity[]>([])
const selectedCategories = ref<number[] | []>([])

const updateSelectedCategoriesFromRoute = () => {
  const routeCategories = route.query.categories
  if (!routeCategories || !categories.value.length) {
    selectedCategories.value = []
    return
  }

  const categoryArray = Array.isArray(routeCategories) ? routeCategories : [routeCategories]

  // Convert category names from URL back to IDs for the component
  const categoryIds = categoryArray.map(nameOrId => {
    // Try to find by name first (new format)
    const byName = categories.value.find(cat => cat.name === nameOrId)
    if (byName) return byName.id

    // Fallback to ID (legacy format)
    const id = Number(nameOrId)
    if (!isNaN(id) && categories.value.find(cat => cat.id === id)) {
      return id
    }

    return null
  }).filter(Boolean)

  selectedCategories.value = categoryIds as number[]
}

watch(
  () => route.query.categories,
  () => updateSelectedCategoriesFromRoute()
)

// Handle filtering by categories (multiple) and update the URL
const onFilterByCategories = (categoryIds: number[]) => {
  selectedCategories.value = categoryIds?.length ? categoryIds : []

  // Create new query object without categories first
  const newQuery = { ...route.query, page: 1 }
  delete (newQuery as Record<string, unknown>).categories

  // Only include categories if there are any selected
  if (categoryIds && categoryIds.length > 0) {
    // Convert category IDs to names for the backend
    const categoryNames = categoryIds.map(id => {
      const category = categories.value.find(cat => cat.id === id)
      return category ? category.name : null
    }).filter(Boolean)

    ;(newQuery as Record<string, unknown>).categories = categoryNames
  }

  router.push({
    path: '',
    query: newQuery
  })
}

onMounted(() => {
  LoadingBar.start()
  categoriesApi.getAll().then(e => {
    categories.value = e.data
    // Initialize selected categories from route after categories are loaded
    updateSelectedCategoriesFromRoute()
  }).finally(LoadingBar.stop)
})

</script>

<template>
  <q-select
    data-cy="categories-filter"
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
    :hide-dropdown-icon="!!selectedCategories?.length"
    style="min-width: 180px;"
    @update:model-value="onFilterByCategories"
  />
</template>

<style scoped lang="scss">

</style>
