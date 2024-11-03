<script setup lang="ts">
import LocationComponent from 'components/common/LocationComponent.vue'
import { ref, watch } from 'vue'
import { AddressLocation } from 'src/types'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const selectedLat = ref<number | null>(Number(route.query.lat) || null)
const selectedLon = ref<number | null>(Number(route.query.lon) || null)
const selectedLocation = ref<string | null>(route.query.location as string || null)

// Handle filtering by location and update the URL
const onFilterByLocation = (addressLocation: AddressLocation) => {
  const { lat, lon, location } = addressLocation

  // Check if both lat and lon are zero
  if (lat === 0 && lon === 0) {
    // Remove location from query if lat/lon are zero
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { location, lat, lon, ...rest } = route.query // Destructure to remove location
    selectedLocation.value = ''
    selectedLat.value = null
    selectedLon.value = null
    router.push({
      query: {
        ...rest,
        page: 1
      }
    })
  } else {
    selectedLocation.value = location as string
    selectedLat.value = lat as number
    selectedLon.value = lon as number
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

// Watch for query changes and update location values accordingly
watch(() => route.query, (newQuery) => {
  selectedLat.value = Number(newQuery.lat) || null
  selectedLon.value = Number(newQuery.lon) || null
  selectedLocation.value = newQuery.location as string || null
})

</script>

<template>
  <LocationComponent
    data-cy="location-filter"
    :location="selectedLocation as string"
    :lat="selectedLat as number"
    :long="selectedLon as number"
    label="Any location"
    clearable
    :outlined="true"
    filled
    :hide-search-icon="!!selectedLocation"
    style="min-width: 200px;"
    @update:model-value="onFilterByLocation"
  />
</template>

<style scoped lang="scss">

</style>
