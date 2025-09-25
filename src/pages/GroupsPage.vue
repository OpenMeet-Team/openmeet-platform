<template>
  <q-page padding style="max-width: 1024px" class="q-mx-auto" data-cy="groups-page">
    <SpinnerComponent v-if="useGroupsStore().isLoading"/>

    <div class="row text-h4">
      <span class="text-bold q-ml-xs">Groups list</span>
    </div>

    <!-- Collapsible Filters Section -->
    <q-expansion-item
      :model-value="showFilters"
      @update:model-value="showFilters = $event"
      icon="sym_r_tune"
      :label="filterLabel"
      header-class="text-h6 q-py-md"
      class="q-mb-md"
    >
      <template v-slot:header>
        <q-item-section avatar>
          <q-icon name="sym_r_tune" />
        </q-item-section>
        <q-item-section>
          <q-item-label class="text-h6">{{ filterLabel }}</q-item-label>
          <q-item-label caption v-if="activeFiltersCount > 0">
            {{ activeFiltersCount }} filter{{ activeFiltersCount > 1 ? 's' : '' }} applied
          </q-item-label>
        </q-item-section>
        <q-item-section side v-if="hasActiveFilters">
          <q-btn
            flat
            dense
            round
            icon="sym_r_clear_all"
            @click.stop="clearAllFilters"
            color="negative"
            size="sm"
            data-cy="groups-clear-all-filters"
          >
            <q-tooltip>Clear all filters</q-tooltip>
          </q-btn>
        </q-item-section>
      </template>

      <div class="row q-col-gutter-md q-pb-md">
        <!-- Single row layout for groups (fewer filters than events) -->
        <div class="col-12 col-sm-6 col-md-4">
          <CategoriesFilterComponent/>
        </div>
        <div class="col-12 col-sm-4 col-md-4">
          <LocationFilterComponent/>
        </div>
        <div class="col-12 col-sm-2 col-md-2">
          <RadiusFilterComponent/>
        </div>
      </div>
    </q-expansion-item>

    <GroupsListComponent
      :groups="groups?.data"
      :loading="useGroupsStore().isLoading"
      :show-pagination="true"
      :current-page="currentPage"
      :total-pages="groups?.totalPages"
      layout="list"
      label=""
      @page-change="onPageChange"
    />

  </q-page>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { LoadingBar, useMeta } from 'quasar'
import { useRoute, useRouter } from 'vue-router'
import SpinnerComponent from '../components/common/SpinnerComponent.vue'
import LocationFilterComponent from '../components/common/LocationFilterComponent.vue'
import CategoriesFilterComponent from '../components/common/CategoriesFilterComponent.vue'
import RadiusFilterComponent from '../components/common/RadiusFilterComponent.vue'
import { useGroupsStore } from '../stores/groups-store'
import GroupsListComponent from '../components/group/GroupsListComponent.vue'
import { useAuthSession } from '../boot/auth-session'

const router = useRouter()
const route = useRoute()

// Filters state
const showFilters = ref(false)

useMeta({
  title: 'Groups'
})

// Pagination
const currentPage = ref(parseInt(route.query.page as string) || 1)
const groups = computed(() => useGroupsStore().groups)

// Filter state helpers
const hasActiveFilters = computed(() => {
  return !!(route.query.categories ||
           route.query.location ||
           route.query.radius)
})

const activeFiltersCount = computed(() => {
  let count = 0
  if (route.query.categories) count++
  if (route.query.location) count++
  if (route.query.radius) count++
  return count
})

const filterLabel = computed(() => {
  return showFilters.value ? 'Filters' : 'Show Filters'
})

const clearAllFilters = () => {
  router.push({ path: route.path })
}

// Auto-open filters if any are active
watch(() => hasActiveFilters.value, (newVal) => {
  if (newVal) {
    showFilters.value = true
  }
}, { immediate: true })

onMounted(async () => {
  LoadingBar.start()

  // First check auth status to ensure we have latest token
  const authSession = useAuthSession()
  await authSession.checkAuthStatus()

  // Now load groups data with latest auth state
  try {
    await useGroupsStore().actionGetGroupsState(route.query)
  } catch (error) {
    console.error('Error loading groups data:', error)
  } finally {
    LoadingBar.stop()
  }
})

onBeforeUnmount(() => {
  useGroupsStore().$reset()
})

const fetchGroups = async () => {
  LoadingBar.start()
  useGroupsStore().actionGetGroups(route.query).finally(LoadingBar.stop)
}

watch(
  () => route.query,
  async (newQuery, oldQuery) => {
    if (JSON.stringify(newQuery) !== JSON.stringify(oldQuery)) {
      currentPage.value = parseInt(newQuery.page as string) || 1
      LoadingBar.start()
      fetchGroups().finally(LoadingBar.stop)
    }
  },
  { immediate: true, deep: true }
)

const onPageChange = (page: number) => {
  router.push({ query: { ...route.query, page } })
}

</script>

<style scoped>

</style>
