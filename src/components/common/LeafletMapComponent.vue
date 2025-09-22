<template>
  <div class="leaflet-map-wrapper">
    <SpinnerComponent v-if="!containerReady"/>
    <div ref="mapContainer" class="leaflet-map-container"></div>
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
const containerReady = ref<boolean>(false)
const initAttempts = ref<number>(0)
const MAX_INIT_ATTEMPTS = 3
const intersectionObserver = ref<IntersectionObserver | null>(null)

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
  const isVisible = (
    rect.width > 0 &&
    rect.height > 0 &&
    mapContainer.value.offsetParent !== null
  )

  // Additional check for computed styles
  if (isVisible) {
    const computedStyle = window.getComputedStyle(mapContainer.value)
    return computedStyle.display !== 'none' && computedStyle.visibility !== 'hidden'
  }

  return false
}

// Force initialization after a timeout, even if visibility checks fail
const forceInitializeAfterTimeout = () => {
  setTimeout(() => {
    if (!map.value && mapContainer.value) {
      console.log('LeafletMap: Force initializing after timeout')
      // Reset visibility check and attempt immediate initialization
      initAttempts.value = 0
      initializeMapDirect()
    }
  }, 3000) // Force init after 3 seconds
}

// Direct initialization without visibility checks
const initializeMapDirect = async () => {
  if (map.value || !mapContainer.value) return

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
    // Ensure container has proper dimensions before creating map
    if (mapContainer.value.offsetWidth === 0 || mapContainer.value.offsetHeight === 0) {
      console.warn('LeafletMap: Container has zero dimensions, waiting for proper sizing')
      setTimeout(() => initializeMapDirect(), 100)
      return
    }

    // Create map instance with proper options
    map.value = L.map(mapContainer.value, {
      preferCanvas: false,
      attributionControl: true,
      zoomControl: true
    }).setView(center, props.zoom)

    // Add tile layer with standard options
    tileLayer.value = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(map.value as LMap)

    addMarker(center, 'Initial location')

    loaded.value = true

    if (!props.disabled) {
      map.value.on('click', handleMapClick)
    }

    window.addEventListener('resize', handleResize)

    // Force Leaflet to recalculate container size to prevent display issues
    setTimeout(() => {
      if (map.value) {
        map.value.invalidateSize({ animate: false, pan: false })
      }
    }, 100)

    console.log('LeafletMap: Successfully initialized')
  } catch (error) {
    console.error('Error initializing map:', error)
    // Reset for potential retry
    map.value = null
    tileLayer.value = null
  }
}

// Initialize map with retry logic
const initializeMap = async () => {
  // Skip if already initialized
  if (map.value) return

  // Check if container is ready
  if (!mapContainer.value || !isContainerVisible()) {
    // If we've attempted too many times, wait for intersection observer to trigger
    if (initAttempts.value >= MAX_INIT_ATTEMPTS) {
      console.log('LeafletMap: Container not visible after multiple attempts, will retry when shown')
      return
    }

    // Increment attempts and try again after a delay
    initAttempts.value++
    // Use a longer delay for better stability
    setTimeout(initializeMap, 1000)
    return
  }

  // If container is visible, use direct initialization
  await initializeMapDirect()
}

// Handle map click
const handleMapClick = (e: L.LeafletMouseEvent) => {
  const { lat, lng } = e.latlng
  clearMarkers()
  addMarker([lat, lng], 'Selected location')
  emit('markerLocation', { lat, lng })
}

// Handle window resize with proper timing
const handleResize = () => {
  if (map.value) {
    // Use setTimeout to ensure the container has finished resizing
    setTimeout(() => {
      if (map.value) {
        map.value.invalidateSize({ animate: false, pan: false })
      }
    }, 100)
  }
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
  // Clean up intersection observer
  if (intersectionObserver.value) {
    intersectionObserver.value.disconnect()
    intersectionObserver.value = null
  }
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
  if (!mapContainer.value || intersectionObserver.value) return

  intersectionObserver.value = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !map.value) {
        // Element is now visible, reset attempts and try initializing map
        initAttempts.value = 0
        nextTick(() => {
          // Add a small delay to ensure the element is fully rendered
          setTimeout(initializeMapDirect, 100)
        })
      }
    })
  }, { threshold: 0.1 })

  intersectionObserver.value.observe(mapContainer.value)
}

// Lifecycle hooks
onMounted(() => {
  // Set up visibility observer first to detect when container becomes visible
  nextTick(() => {
    // Mark container as ready to show the map div (hide spinner)
    containerReady.value = true
    setupVisibilityObserver()
    // Try initializing after a small delay to allow parent component to fully render
    setTimeout(() => {
      initializeMap()
    }, 200)
    // Set up force initialization as a fallback
    forceInitializeAfterTimeout()
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

<style scoped>
.leaflet-map-wrapper {
  position: relative;
  width: 100%;
  height: 300px;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
}

.leaflet-map-container {
  width: 100%;
  height: 100%;
  position: relative;
  z-index: 1;
  overflow: hidden;
}

/* Ensure Leaflet container fills the space properly */
:deep(.leaflet-container) {
  width: 100% !important;
  height: 100% !important;
}
</style>

<style>
.leaflet-default-icon-path {
  background-image: url('leaflet/dist/images/marker-icon.png');
}
</style>
