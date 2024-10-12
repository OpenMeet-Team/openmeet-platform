<template>
<!--  <q-spinner v-if="loading" size="50px" color="primary" class="absolute-center">-->
<!--    Loading map...-->
<!--  </q-spinner>-->
  <div ref="mapContainer" class="full-height full-width"></div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import type { Map as LMap, Marker, TileLayer } from 'leaflet'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Refs and interfaces
const mapContainer = ref<HTMLElement | null>(null)
const map = ref<LMap | null>(null)
const tileLayer = ref<TileLayer | null>(null)
const markers = ref<Marker[]>([])
// const loading = ref(true)

const emit = defineEmits(['markerLocation'])

interface Props {
  lat?: number
  lon?: number
  disabled?: boolean
}
const props = defineProps<Props>()

interface MapOptions {
  center: [number, number]
  zoom: number
}

// Default map options
const defaultMapOptions: MapOptions = {
  center: [39.8333, 98.5855],
  zoom: 13
}

// Get user location
const getUserLocation = (): Promise<[number, number]> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser.'))
    } else {
      navigator.geolocation.getCurrentPosition(
        position => {
          const { latitude, longitude } = position.coords
          resolve([latitude, longitude])
        },
        () => {
          reject(new Error('Unable to retrieve your location.'))
        }
      )
    }
  })
}

// Initialize map
const initializeMap = async () => {
  if (!mapContainer.value) return

  let center: [number, number] = defaultMapOptions.center

  // Use provided props for lat/lon or fall back to user location
  if (props.lat && props.lon) {
    center = [props.lat, props.lon] as [number, number]
  } else {
    try {
      center = await getUserLocation()
    } catch (error) {
      console.error('Error getting user location, using default center.', error)
    }
  }

  // Create map instance
  map.value = L.map(mapContainer.value).setView(
    // defaultMapOptions.center,
    center,
    defaultMapOptions.zoom
  )

  // Add tile layer
  if (map.value) {
    tileLayer.value = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map.value as LMap)
  }

  const initialMarker = L.marker(center).addTo(map.value as LMap)
  markers.value.push(initialMarker)

  // loading.value = false

  let marker: L.Marker | null = null

  // Add click event to the map
  if (!props.disabled) {
    map.value.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng

      // If there's an existing marker, remove it
      if (marker) {
        map.value?.removeLayer(marker)
      }

      if (initialMarker) map.value?.removeLayer(initialMarker)

      // addMarker([lat, lng], '')
      // Add a new marker at the clicked position
      marker = L.marker([lat, lng]).addTo(map.value as LMap)

      // Emit the clicked location
      emit('markerLocation', { lat, lng })
    })
  }

  window.addEventListener('resize', () => {
    map.value?.invalidateSize()
  })
}

// Add a new marker
const addMarker = async (position: [number, number], popupText: string) => {
  if (!map.value) return

  console.log(position, popupText)
  if (map.value) {
    const marker = L.marker(position).addTo(map.value as LMap).bindPopup(popupText)
    markers.value.push(marker)
  }
}

// Clean up function
const cleanup = () => {
  markers.value.forEach(marker => marker.remove())
  markers.value = []

  tileLayer.value?.remove()
  map.value?.remove()

  map.value = null
  tileLayer.value = null
}

// Lifecycle hooks
onMounted(() => {
  initializeMap()
})

onUnmounted(() => {
  cleanup()
})

// Expose methods for parent components
defineExpose({
  addMarker
})
</script>

<style>
.leaflet-default-icon-path {
  background-image: url('leaflet/dist/images/marker-icon.png');
}
</style>
