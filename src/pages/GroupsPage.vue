<template>
  <q-page class="q-pa-md" v-if="loaded">
    <div class="row q-col-gutter-md q-mb-md">
      <div class="col-12 col-md-6">
        <q-select
          :model-value="selectedCategories"
          :options="categories"
          label="Filter by Categories"
          outlined
          emit-value
          map-options
          multiple
          clearable
          option-value="id"
          option-label="name"
          class="full-width"
          @update:model-value="onFilterByCategories"
        />
      </div>
      <div class="col-12 col-md-6">
        <LocationComponent
          :filled="false"
          :location="selectedLocation as string"
          :lat="selectedLat as number"
          :long="selectedLon as number"
          label="Filter by address"
          class="full-width"
          clearable
          :outlined="true"
          @update:model-value="onFilterByLocation"
        />
      </div>
    </div>

    <div class="row q-col-gutter-md">
      <div v-for="group in groups.data" :key="group.id" class="col-12 col-md-6 col-lg-4">
        <GroupsItemComponent :group="group" @view="viewGroup" @join="joinGroup"/>
      </div>
    </div>

    <div v-if="groups.data.length === 0" class="text-center q-mt-xl">
      <q-icon name="sym_r_search_off" size="4em" color="grey-5" />
      <p class="text-h6 text-grey-6">No groups found matching your criteria</p>
    </div>

    <q-pagination v-if="groups && groups.totalPages && groups.totalPages > 1"
                  v-model="currentPage"
                  :max="groups.totalPages"
                  @input="onPageChange"
    />
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { LoadingBar } from 'quasar'
import { useRoute, useRouter } from 'vue-router'
import { groupsApi } from 'src/api/groups.ts'
import { categoriesApi } from 'src/api/categories.ts'
import { AddressLocation, CategoryEntity, GroupPaginationEntity } from 'src/types'
import GroupsItemComponent from 'components/group/GroupsItemComponent.vue'
import { useNotification } from 'src/composables/useNotification.ts'
import LocationComponent from 'components/common/LocationComponent.vue'

const router = useRouter()
const route = useRoute()

// Pagination
const currentPage = ref(parseInt(route.query.page as string) || 1)
const loaded = ref<boolean>(false)

// Fetch categories and groups when the component is mounted
onMounted(() => {
  LoadingBar.start()
  Promise.all([
    fetchGroups(),
    categoriesApi.getAll().then(res => {
      categories.value = res.data
    })
  ]).finally(() => {
    loaded.value = true
    LoadingBar.stop()
  })
})

// Fetch groups based on the query parameters
const fetchGroups = async () => {
  LoadingBar.start()
  groupsApi.getAll(route.query).then(res => {
    groups.value = res.data
  }).finally(LoadingBar.stop)
}

// Refetch groups when query parameters (category, location, page) change
watch(() => route.query, fetchGroups)

// Handle pagination changes and update the URL
const onPageChange = (page: number) => {
  router.push({ query: { ...route.query, page } })
}

// Handle filtering by categories (multiple) and update the URL
const onFilterByCategories = (categoryIds: number[]) => {
  selectedCategories.value = categoryIds

  router.push({
    path: '',
    query: {
      ...route.query,
      categories: (categoryIds && categoryIds.length) ? categoryIds : undefined,
      page: 1
    }
  })
}

// Handle filtering by location and update the URL
const onFilterByLocation = (addressLocation: AddressLocation) => {
  const { lat, lon, location } = addressLocation

  // Check if both lat and lon are zero
  if (lat === 0 && lon === 0) {
    // Remove location from query if lat/lon are zero
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { location, lat, lon, ...rest } = route.query // Destructure to remove location
    selectedLocation.value = ''
    router.push({
      query: {
        ...rest,
        page: 1
      }
    })
  } else {
    // const locationString = `${lat},${lon}`
    selectedLocation.value = location as string
    router.push({
      query: {
        ...route.query,
        location,
        lat,
        lon,
        page: 1
      }
    })
  }
}

// Handle viewing a group
const viewGroup = (groupId: number) => {
  router.push({ name: 'GroupPage', params: { id: groupId } })
}

// Handle joining a group
const joinGroup = (groupId: number) => {
  const group = groups.value.data.find(g => g.id === groupId)
  if (group) {
    groupsApi.join(groupId).then(() => {
      success(`You've joined ${group.name}!`)
    }).catch(err => {
      console.error(err.message)
      error('Joining group failed. Please try again')
    })
  }
}

// Data and state
const categories = ref<CategoryEntity[]>([])
const groups = ref<GroupPaginationEntity>({
  data: [],
  total: 0,
  page: 1,
  totalPages: 0
})
const selectedCategories = ref<number[]>(Array.isArray(route.query.categories) ? route.query.categories.map(Number) : route.query.categories ? [Number(route.query.categories)] : [])
const selectedLocation = ref<string | null>(route.query.location as string || null)
const selectedLat = ref<number | null>(Number(route.query.lat) || null)
const selectedLon = ref<number | null>(Number(route.query.lon) || null)
const { success, error } = useNotification()

</script>

<style scoped>
.group-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.group-card .q-card__section:nth-last-child(2) {
  flex-grow: 1;
}
</style>
