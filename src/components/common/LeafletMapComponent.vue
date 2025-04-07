<template>
  <div class="relative full-height full-width">
    <SpinnerComponent v-if="!loaded"/>
    <div ref="mapContainer" class="full-height full-width"></div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch, nextTick } from 'vue'
import type { Map as LMap, Marker, TileLayer } from 'leaflet'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import SpinnerComponent from '../common/SpinnerComponent.vue'

// Refs and interfaces
const mapContainer = ref<HTMLElement | null>(null)
const map = ref<LMap | null>(null)
const tileLayer = ref<TileLayer | null>(null)
const markers = ref<Marker[]>([])
const loaded = ref<boolean>(false)
const initAttempts = ref<number>(0)
const MAX_INIT_ATTEMPTS = 3

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

// Check if container is visible in DOM
const isContainerVisible = (): boolean => {
  if (!mapContainer.value) return false

  // Check if element has dimensions and is in the DOM
  const rect = mapContainer.value.getBoundingClientRect()
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    mapContainer.value.offsetParent !== null
  )
}

// Initialize map with retry logic
const initializeMap = async () => {
  // Skip if already initialized
  if (map.value) return

  // Check if container is ready
  if (!mapContainer.value || !isContainerVisible()) {
    // If we've attempted too many times, log error and stop trying
    if (initAttempts.value >= MAX_INIT_ATTEMPTS) {
      console.warn('LeafletMap: Container not visible after multiple attempts, will retry when shown')
      return
    }

    // Increment attempts and try again after a delay
    initAttempts.value++
    setTimeout(initializeMap, 500)
    return
  }

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

  try {
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
  } catch (error) {
    console.error('Error initializing map:', error)
    // Reset for potential retry
    map.value = null
    tileLayer.value = null
  }
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
    if (map.value) {
      updateMapView(newLat, newLon)
    } else {
      // If map isn't initialized yet, try initializing it
      nextTick(initializeMap)
    }
  }
})

// Watch for changes in the visibility of the container
const setupVisibilityObserver = () => {
  if (!mapContainer.value) return

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !map.value) {
        // Element is now visible, try initializing map
        nextTick(initializeMap)
      }
    })
  }, { threshold: 0.1 })

  observer.observe(mapContainer.value)

  // Cleanup observer on unmount
  onUnmounted(() => {
    observer.disconnect()
  })
}

// Lifecycle hooks
onMounted(() => {
  // First try initializing directly
  nextTick(() => {
    initializeMap()
    // Also set up visibility observer to detect when container becomes visible
    setupVisibilityObserver()
  })
})

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
