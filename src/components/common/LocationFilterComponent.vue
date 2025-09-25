<script setup lang="ts">
import LocationComponent from '../../components/common/LocationComponent.vue'
import { ref, watch } from 'vue'
import { AddressLocation } from '../../types'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const selectedLat = ref<number | null>(Number(route.query.lat) || null)
const selectedLon = ref<number | null>(Number(route.query.lon) || null)
const selectedLocation = ref<string | null>(route.query.location as string || null)

// Handle filtering by location and update the URL
const onFilterByLocation = (addressLocation: AddressLocation) => {
  const { lat, lon, location } = addressLocation

  // Check if location is cleared (empty or coordinates are zero)
  if (!location || (lat === 0 && lon === 0)) {
    // Remove location from query if cleared
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { location: _, lat: __, lon: ___, radius, ...rest } = route.query // Also remove radius when location is cleared
    selectedLocation.value = null
    selectedLat.value = null
    selectedLon.value = null
    router.push({
      query: {
        ...rest,
        page: 1
      }
    })
  } else {
    selectedLocation.value = location
    selectedLat.value = lat
    selectedLon.value = lon
    router.push({
      query: {
        ...route.query,
        location,
        lat: lat.toString(),
        lon: lon.toString(),
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
    :lon="selectedLon as number"
    label="Any location"
    placeholder="Search by city or address"
    clearable
    :outlined="true"
    filled
    style="min-width: 200px; width: 100%;"
    @update:model-value="onFilterByLocation"
  />
</template>

<style scoped lang="scss">

</style>
