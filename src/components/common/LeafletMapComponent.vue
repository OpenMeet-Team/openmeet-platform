<template>
  <div class="relative full-height full-width">
    <q-spinner v-if="!loaded" size="50px" color="primary" class="absolute-center">
      Loading map...
    </q-spinner>
    <div ref="mapContainer" class="full-height full-width"></div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import type { Map as LMap, Marker, TileLayer } from 'leaflet'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Refs and interfaces
const mapContainer = ref<HTMLElement | null>(null)
const map = ref<LMap | null>(null)
const tileLayer = ref<TileLayer | null>(null)
const markers = ref<Marker[]>([])
const loaded = ref<boolean>(false)

const emit = defineEmits(['markerLocation'])

interface Props {
  lat?: number
  lon?: number
  disabled?: boolean
  zoom?: number
}

const props = withDefaults(defineProps<Props>(), {
  zoom: 13
})

interface MapOptions {
  center: [number, number]
  zoom: number
}

// Default map options
const defaultMapOptions: MapOptions = {
  center: [39.8333, 98.5855],
  zoom: props.zoom
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
    center = [props.lat, props.lon]
  } else {
    try {
      center = await getUserLocation()
    } catch (error) {
      console.error('Error getting user location, using default center.', error)
    }
  }

  // Create map instance
  map.value = L.map(mapContainer.value).setView(center, props.zoom)

  // Add tile layer
  tileLayer.value = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map.value as LMap)

  addMarker(center, 'Initial location')

  loaded.value = true

  if (!props.disabled) {
    map.value.on('click', handleMapClick)
  }

  window.addEventListener('resize', handleResize)
}

// Handle map click
const handleMapClick = (e: L.LeafletMouseEvent) => {
  const { lat, lng } = e.latlng
  clearMarkers()
  addMarker([lat, lng], 'Selected location')
  emit('markerLocation', { lat, lng })
}

// Handle window resize
const handleResize = () => {
  map.value?.invalidateSize()
}

// Add a new marker
const addMarker = (position: [number, number], popupText: string) => {
  if (!map.value) return

  const marker = L.marker(position).addTo(map.value as LMap).bindPopup(popupText)
  markers.value.push(marker)
}

// Clear all markers
const clearMarkers = () => {
  markers.value.forEach(marker => marker.remove())
  markers.value = []
}

// Update map view
const updateMapView = (lat: number, lon: number) => {
  if (!map.value) return

  map.value.setView([lat, lon], props.zoom)
  clearMarkers()
  addMarker([lat, lon], 'Updated location')
}

// Clean up function
const cleanup = () => {
  clearMarkers()
  tileLayer.value?.remove()
  map.value?.remove()
  map.value = null
  tileLayer.value = null
  window.removeEventListener('resize', handleResize)
}

// Watch for changes in lat and lon props
watch(() => [props.lat, props.lon], ([newLat, newLon]) => {
  if (newLat && newLon) {
    updateMapView(newLat, newLon)
  }
})

// Lifecycle hooks
onMounted(initializeMap)
onUnmounted(cleanup)

// Expose methods for parent components
defineExpose({
  addMarker,
  clearMarkers,
  updateMapView
})
</script>

<style>
.leaflet-default-icon-path {
  background-image: url('leaflet/dist/images/marker-icon.png');
}
</style>
