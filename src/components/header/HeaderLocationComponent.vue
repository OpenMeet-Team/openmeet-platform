<template>
    <div v-if="geoData" @click="fetchLocation"><span v-if="geoData.stateName">{{ geoData.stateName }}, </span>{{ geoData.country }}</div>
</template>

<script lang="ts" setup>
import { ref, onBeforeMount } from 'vue'
import { getGeoLocation } from '../../utils/geoLocation'
import { OneTrustGeoLocationResponse } from '../../types' // Utility function with caching

const geoData = ref<OneTrustGeoLocationResponse | null>(null)

onBeforeMount(async () => {
  geoData.value = await getGeoLocation()
})

const fetchLocation = async () => {
  geoData.value = await getGeoLocation(true)
}

</script>
