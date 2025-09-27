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

// Fix for Leaflet marker icons not displaying
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png'
})

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

// Initialization state tracking to prevent race conditions
const isInitializing = ref<boolean>(false)
const timeouts = ref<number[]>([]) // Track all timeouts for cleanup

const emit = defineEmits(['markerLocation'])

// Helper function to track timeouts for cleanup
const safeSetTimeout = (callback: () => void, delay: number): number => {
  const timeoutId = setTimeout(callback, delay) as unknown as number
  timeouts.value.push(timeoutId)
  return timeoutId
}

// Clear all tracked timeouts
const clearAllTimeouts = () => {
  timeouts.value.forEach(id => clearTimeout(id))
  timeouts.value = []
}

interface Props {
  lat?: number
  lon?: number
  disabled?: boolean
  zoom?: number
}

const props = withDefaults(defineProps<Props>(), {
  zoom: 13
})

// Tile monitoring variables
let tileMonitoringInterval: number | null = null
const initStartTime = Date.now()

// Comprehensive tile monitoring
const logTileState = () => {
  if (!mapContainer.value) return

  const container = mapContainer.value
  const tiles = container.querySelectorAll('.leaflet-tile')
  const tileContainers = container.querySelectorAll('.leaflet-tile-container')
  const tilePanes = container.querySelectorAll('.leaflet-tile-pane')

  const tileData = {
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    containerDimensions: {
      client: { width: container.clientWidth, height: container.clientHeight },
      offset: { width: container.offsetWidth, height: container.offsetHeight },
      bounding: container.getBoundingClientRect()
    },
    tileStats: {
      totalTiles: tiles.length,
      tileContainers: tileContainers.length,
      tilePanes: tilePanes.length
    },
    tileDetails: [],
    missingPositions: [],
    suspiciousGaps: []
  }

  // Analyze each tile
  tiles.forEach((tile, index) => {
    const element = tile as HTMLElement
    const rect = element.getBoundingClientRect()
    const style = window.getComputedStyle(element)

    const tileInfo = {
      index,
      src: element.getAttribute('src'),
      loaded: (element as HTMLImageElement).complete && (element as HTMLImageElement).naturalHeight !== 0,
      visible: rect.width > 0 && rect.height > 0,
      position: {
        left: style.left,
        top: style.top,
        transform: style.transform,
        webkitTransform: style.webkitTransform
      },
      dimensions: {
        width: rect.width,
        height: rect.height
      },
      boundingRect: rect,
      computedStyle: {
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        zIndex: style.zIndex
      }
    }

    tileData.tileDetails.push(tileInfo)

    // Detect potential issues
    if (!tileInfo.loaded) {
      console.warn('🔴 TILE NOT LOADED:', tileInfo.src, tileInfo)
    }

    if (!tileInfo.visible) {
      console.warn('🔴 TILE NOT VISIBLE:', tileInfo.src, tileInfo)
    }

    if (!tileInfo.position.transform && !tileInfo.position.webkitTransform) {
      console.warn('🔴 TILE MISSING TRANSFORM:', tileInfo.src, tileInfo)
    }
  })

  // Get container rect for checkerboard detection
  const containerRect = container.getBoundingClientRect()

  // Detect checkerboard positioning pattern (tiles touching at corners only)
  if (tiles.length >= 4) {
    const tilePositions = Array.from(tiles).map(tile => {
      const element = tile as HTMLElement
      const rect = element.getBoundingClientRect()
      return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height
      }
    })

    // Check for gaps between adjacent tiles (avoid double counting)
    let tilesWithGaps = 0
    let totalAdjacencies = 0
    const checkedPairs = new Set()

    tilePositions.forEach((tile, i) => {
      tilePositions.forEach((otherTile, j) => {
        if (i >= j) return // Avoid double counting and self-comparison

        const pairKey = `${i}-${j}`
        if (checkedPairs.has(pairKey)) return
        checkedPairs.add(pairKey)

        // Check if tiles are actually adjacent (share an edge)
        let isHorizontallyAdjacent = false
        let isVerticallyAdjacent = false
        let hasGap = false

        // Horizontal adjacency: tiles side by side
        if (Math.abs(tile.top - otherTile.top) < 2 && Math.abs(tile.bottom - otherTile.bottom) < 2) {
          // Same vertical position, check horizontal alignment
          const gap1 = Math.abs(tile.right - otherTile.left)
          const gap2 = Math.abs(otherTile.right - tile.left)
          const minGap = Math.min(gap1, gap2)

          if (minGap < 5) {
            isHorizontallyAdjacent = true
            if (minGap > 2) hasGap = true
          }
        }

        // Vertical adjacency: tiles stacked vertically
        if (Math.abs(tile.left - otherTile.left) < 2 && Math.abs(tile.right - otherTile.right) < 2) {
          // Same horizontal position, check vertical alignment
          const gap1 = Math.abs(tile.bottom - otherTile.top)
          const gap2 = Math.abs(otherTile.bottom - tile.top)
          const minGap = Math.min(gap1, gap2)

          if (minGap < 5) {
            isVerticallyAdjacent = true
            if (minGap > 2) hasGap = true
          }
        }

        if (isHorizontallyAdjacent || isVerticallyAdjacent) {
          totalAdjacencies++
          if (hasGap) {
            tilesWithGaps++
          }
        }
      })
    })

    const gapPercentage = totalAdjacencies > 0 ? (tilesWithGaps / totalAdjacencies) * 100 : 0

    if (gapPercentage > 30) { // More than 30% of adjacent tiles have gaps
      console.error('🚨 CHECKERBOARD POSITIONING DETECTED - Tiles have gaps:', {
        tilesWithGaps,
        totalAdjacencies,
        gapPercentage: Math.round(gapPercentage),
        tilePositions,
        containerRect,
        tileData
      })

      // Log detailed position analysis
      console.error('📍 DETAILED TILE POSITIONS:')
      tilePositions.forEach((tile, i) => {
        console.error(`  Tile ${i}: left=${tile.left.toFixed(1)}, top=${tile.top.toFixed(1)}, right=${tile.right.toFixed(1)}, bottom=${tile.bottom.toFixed(1)}, size=${tile.width.toFixed(1)}x${tile.height.toFixed(1)}`)
      })

      // Analyze gaps between actually adjacent tiles
      console.error('🔍 GAP ANALYSIS:')
      const analysisCheckedPairs = new Set()
      tilePositions.forEach((tile, i) => {
        tilePositions.forEach((otherTile, j) => {
          if (i >= j) return

          const pairKey = `${i}-${j}`
          if (analysisCheckedPairs.has(pairKey)) return
          analysisCheckedPairs.add(pairKey)

          // Check horizontal adjacency
          if (Math.abs(tile.top - otherTile.top) < 2 && Math.abs(tile.bottom - otherTile.bottom) < 2) {
            const gap = Math.min(Math.abs(tile.right - otherTile.left), Math.abs(otherTile.right - tile.left))
            if (gap < 5) {
              console.error(`  Horizontal adjacency ${i}-${j}: gap=${gap.toFixed(1)}px ${gap > 2 ? '❌ HAS GAP' : '✅ touching'}`)
            }
          }

          // Check vertical adjacency
          if (Math.abs(tile.left - otherTile.left) < 2 && Math.abs(tile.right - otherTile.right) < 2) {
            const gap = Math.min(Math.abs(tile.bottom - otherTile.top), Math.abs(otherTile.bottom - tile.top))
            if (gap < 5) {
              console.error(`  Vertical adjacency ${i}-${j}: gap=${gap.toFixed(1)}px ${gap > 2 ? '❌ HAS GAP' : '✅ touching'}`)
            }
          }
        })
      })
    }
  }

  // Log summary periodically
  if (tileData.tileStats.totalTiles > 0) {
    console.log('📊 TILE STATE SUMMARY:', {
      total: tileData.tileStats.totalTiles,
      loaded: tileData.tileDetails.filter(t => t.loaded).length,
      visible: tileData.tileDetails.filter(t => t.visible).length,
      withTransform: tileData.tileDetails.filter(t => t.position.transform || t.position.webkitTransform).length
    })
  }

  return tileData
}

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
  safeSetTimeout(() => {
    if (!map.value && !isInitializing.value && mapContainer.value) {
      console.log('LeafletMap: Force initializing after timeout')
      // Reset visibility check and attempt immediate initialization
      initAttempts.value = 0
      initializeMapDirect()
    } else {
      console.log('🚫 Skipping force timeout initialization:', { hasMap: !!map.value, isInitializing: isInitializing.value })
    }
  }, 3000) // Force init after 3 seconds
}

// Direct initialization without visibility checks
const initializeMapDirect = async () => {
  // Prevent multiple simultaneous initialization attempts
  if (map.value || !mapContainer.value || isInitializing.value) {
    console.log('🚫 Skipping map initialization:', { hasMap: !!map.value, hasContainer: !!mapContainer.value, isInitializing: isInitializing.value })
    return
  }

  isInitializing.value = true
  console.log('🚀 Starting map initialization...')

  // Log container dimensions at initialization time
  const container = mapContainer.value
  const rect = container.getBoundingClientRect()
  const dimensions = {
    boundingRect: { width: rect.width, height: rect.height },
    offset: { width: container.offsetWidth, height: container.offsetHeight },
    client: { width: container.clientWidth, height: container.clientHeight },
    computed: window.getComputedStyle(container).width + ' x ' + window.getComputedStyle(container).height
  }

  console.log('Map initialization - Container dimensions:', dimensions)

  if (rect.width === 0 || rect.height === 0) {
    console.warn('ZERO DIMENSIONS detected during initialization!', dimensions)
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
    console.log('Creating Leaflet map instance with dimensions:', dimensions)
    map.value = L.map(mapContainer.value).setView(center, props.zoom)

    // Check dimensions again after map creation
    const postMapRect = container.getBoundingClientRect()
    console.log('Post-map creation dimensions:', {
      before: dimensions.boundingRect,
      after: { width: postMapRect.width, height: postMapRect.height }
    })

    // Add tile layer with event listeners
    console.log('Adding tile layer...')
    tileLayer.value = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      errorTileUrl: '' // Don't show error tile image
    })

    // Add tile loading event listeners
    tileLayer.value.on('tileerror', (e: L.TileErrorEvent) => {
      console.warn('Tile failed to load:', e.tile.src, e.error)
    })

    tileLayer.value.on('tileload', (e: L.TileEvent) => {
      console.log('Tile loaded successfully:', e.tile.src)
    })

    tileLayer.value.on('loading', () => {
      console.log('Started loading tiles...')
    })

    tileLayer.value.on('load', () => {
      console.log('Finished loading all tiles')
      setTimeout(() => {
        logTileState()
        startTileMonitoring()
      }, 100)
    })

    tileLayer.value.addTo(map.value as LMap)

    addMarker(center, 'Initial location')

    loaded.value = true

    if (!props.disabled) {
      map.value.on('click', handleMapClick)
    }

    window.addEventListener('resize', handleResize)

    // Force Leaflet to recalculate container size to prevent display issues
    setTimeout(() => {
      if (map.value) {
        // Capture all dimension types before invalidation
        const beforeRect = container.getBoundingClientRect()
        const beforeDimensions = {
          boundingRect: { width: beforeRect.width, height: beforeRect.height },
          offset: { width: container.offsetWidth, height: container.offsetHeight },
          client: { width: container.clientWidth, height: container.clientHeight },
          computed: {
            width: window.getComputedStyle(container).width,
            height: window.getComputedStyle(container).height
          }
        }

        map.value.invalidateSize()

        // Capture all dimension types after invalidation
        const afterRect = container.getBoundingClientRect()
        const afterDimensions = {
          boundingRect: { width: afterRect.width, height: afterRect.height },
          offset: { width: container.offsetWidth, height: container.offsetHeight },
          client: { width: container.clientWidth, height: container.clientHeight },
          computed: {
            width: window.getComputedStyle(container).width,
            height: window.getComputedStyle(container).height
          }
        }

        console.log('📏 Size invalidation - BEFORE vs AFTER:')
        console.log(`  🔸 BEFORE: boundingRect=${beforeDimensions.boundingRect.width}x${beforeDimensions.boundingRect.height}, offset=${beforeDimensions.offset.width}x${beforeDimensions.offset.height}, client=${beforeDimensions.client.width}x${beforeDimensions.client.height}, computed=${beforeDimensions.computed.width} x ${beforeDimensions.computed.height}`)
        console.log(`  🔹 AFTER:  boundingRect=${afterDimensions.boundingRect.width}x${afterDimensions.boundingRect.height}, offset=${afterDimensions.offset.width}x${afterDimensions.offset.height}, client=${afterDimensions.client.width}x${afterDimensions.client.height}, computed=${afterDimensions.computed.width} x ${afterDimensions.computed.height}`)

        const changes = {
          boundingRect: beforeDimensions.boundingRect.width !== afterDimensions.boundingRect.width ||
                       beforeDimensions.boundingRect.height !== afterDimensions.boundingRect.height,
          offset: beforeDimensions.offset.width !== afterDimensions.offset.width ||
                 beforeDimensions.offset.height !== afterDimensions.offset.height,
          client: beforeDimensions.client.width !== afterDimensions.client.width ||
                 beforeDimensions.client.height !== afterDimensions.client.height,
          computed: beforeDimensions.computed.width !== afterDimensions.computed.width ||
                   beforeDimensions.computed.height !== afterDimensions.computed.height
        }

        console.log(`  🔄 CHANGED: boundingRect=${changes.boundingRect}, offset=${changes.offset}, client=${changes.client}, computed=${changes.computed}`)

        // Log zero dimensions specifically
        if (afterDimensions.boundingRect.width === 0 || afterDimensions.boundingRect.height === 0) {
          console.warn('⚠️ Container still has zero dimensions after invalidateSize!')
        }
      }
    }, 100)

    const finalElapsed = Date.now() - initStartTime
    console.log('LeafletMap: Successfully initialized in', finalElapsed, 'ms')
  } catch (error) {
    console.error('Error initializing map:', error)
    // Reset for potential retry, but keep initialization guard to prevent immediate duplicate attempts
    map.value = null
    tileLayer.value = null
  } finally {
    isInitializing.value = false
    console.log('✅ Map initialization completed (success or error)')
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

// Handle window resize
const handleResize = () => {
  if (!map.value || !mapContainer.value) return

  const container = mapContainer.value

  // Capture dimensions before resize invalidation
  const beforeRect = container.getBoundingClientRect()
  const beforeDimensions = {
    boundingRect: { width: beforeRect.width, height: beforeRect.height },
    offset: { width: container.offsetWidth, height: container.offsetHeight },
    client: { width: container.clientWidth, height: container.clientHeight }
  }

  map.value.invalidateSize()

  // Capture dimensions after resize invalidation
  const afterRect = container.getBoundingClientRect()
  const afterDimensions = {
    boundingRect: { width: afterRect.width, height: afterRect.height },
    offset: { width: container.offsetWidth, height: container.offsetHeight },
    client: { width: container.clientWidth, height: container.clientHeight }
  }

  console.log('📏 Window resize invalidation - BEFORE vs AFTER:')
  console.log(`  🔸 BEFORE: boundingRect=${beforeDimensions.boundingRect.width}x${beforeDimensions.boundingRect.height}, offset=${beforeDimensions.offset.width}x${beforeDimensions.offset.height}, client=${beforeDimensions.client.width}x${beforeDimensions.client.height}`)
  console.log(`  🔹 AFTER:  boundingRect=${afterDimensions.boundingRect.width}x${afterDimensions.boundingRect.height}, offset=${afterDimensions.offset.width}x${afterDimensions.offset.height}, client=${afterDimensions.client.width}x${afterDimensions.client.height}`)

  const changes = {
    boundingRect: beforeDimensions.boundingRect.width !== afterDimensions.boundingRect.width ||
                 beforeDimensions.boundingRect.height !== afterDimensions.boundingRect.height,
    offset: beforeDimensions.offset.width !== afterDimensions.offset.width ||
           beforeDimensions.offset.height !== afterDimensions.offset.height,
    client: beforeDimensions.client.width !== afterDimensions.client.width ||
           beforeDimensions.client.height !== afterDimensions.client.height
  }

  console.log(`  🔄 CHANGED: boundingRect=${changes.boundingRect}, offset=${changes.offset}, client=${changes.client}`)
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
  console.log('🧹 Cleaning up LeafletMapComponent')

  // Clear all pending timeouts to prevent delayed initialization
  clearAllTimeouts()

  // Reset initialization state
  isInitializing.value = false

  // Clean up map resources
  clearMarkers()
  tileLayer.value?.remove()
  map.value?.remove()
  map.value = null
  tileLayer.value = null

  // Remove event listeners
  window.removeEventListener('resize', handleResize)

  // Clean up intersection observer
  if (intersectionObserver.value) {
    intersectionObserver.value.disconnect()
    intersectionObserver.value = null
  }

  // Clean up monitoring
  stopTileMonitoring()

  console.log('✅ LeafletMapComponent cleanup completed')
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
      if (entry.isIntersecting && !map.value && !isInitializing.value) {
        // Element is now visible, reset attempts and try initializing map
        console.log('Map container is visible, initializing...')
        initAttempts.value = 0
        nextTick(() => {
          // Add a small delay to ensure the element is fully rendered
          safeSetTimeout(initializeMapDirect, 100)
        })
      } else if (entry.isIntersecting) {
        console.log('🚫 Skipping intersection observer initialization:', { hasMap: !!map.value, isInitializing: isInitializing.value })
      }
    })
  }, { threshold: 0.1 })

  intersectionObserver.value.observe(mapContainer.value)
}

const startTileMonitoring = () => {
  if (tileMonitoringInterval) return

  console.log('🔍 Starting automatic tile monitoring...')

  // Monitor tiles every 3 seconds
  tileMonitoringInterval = setInterval(() => {
    logTileState()
  }, 3000) as unknown as number

  // Also monitor on specific events that might cause issues
  if (map.value) {
    map.value.on('zoomstart', () => {
      console.log('🔍 ZOOM START - monitoring for tile issues...')
    })

    map.value.on('zoomend', () => {
      console.log('🔍 ZOOM END - checking tile state...')
      setTimeout(() => logTileState(), 500)
    })

    map.value.on('moveend', () => {
      console.log('🔍 MOVE END - checking tile state...')
      setTimeout(() => logTileState(), 200)
    })
  }

  // Mobile-specific monitoring
  if (/Mobi|Android/i.test(navigator.userAgent)) {
    console.log('📱 MOBILE DEVICE DETECTED - Enhanced monitoring active')

    // Monitor orientation changes
    window.addEventListener('orientationchange', () => {
      console.log('📱 ORIENTATION CHANGE detected')
      setTimeout(() => {
        console.log('📱 Post-orientation tile check:')
        logTileState()
      }, 1000)
    })

    // Monitor visibility changes (app switching)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        console.log('📱 APP BECAME VISIBLE - checking tile state')
        setTimeout(() => logTileState(), 500)
      }
    })

    // Monitor network changes
    if ('connection' in navigator) {
      const connection = (navigator as Navigator & { connection: { effectiveType: string; addEventListener: (event: string, callback: () => void) => void } }).connection
      connection.addEventListener('change', () => {
        console.log('📱 NETWORK CHANGE:', connection.effectiveType)
        setTimeout(() => logTileState(), 1000)
      })
    }
  }
}

const stopTileMonitoring = () => {
  if (tileMonitoringInterval) {
    clearInterval(tileMonitoringInterval)
    tileMonitoringInterval = null
    console.log('🔍 Stopped tile monitoring')
  }
}

// Lifecycle hooks
onMounted(() => {
  console.log('🏗️ LeafletMapComponent mounted')
  // Set up visibility observer first to detect when container becomes visible
  nextTick(() => {
    // Mark container as ready to show the map div (hide spinner)
    containerReady.value = true
    setupVisibilityObserver()
    // Try initializing after a small delay to allow parent component to fully render
    safeSetTimeout(() => {
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
  overflow: hidden;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
}

.leaflet-map-container {
  width: 100%;
  height: 100%;
  position: relative;
  z-index: 1;
}

/* Ensure Leaflet controls stay within bounds */
:deep(.leaflet-container) {
  width: 100% !important;
  height: 100% !important;
  position: relative !important;
  z-index: 1 !important;
}

/* Fix for Leaflet popup z-index issues */
:deep(.leaflet-popup-pane) {
  z-index: 2 !important;
}

/* Ensure attribution stays within bounds */
:deep(.leaflet-control-attribution) {
  position: absolute !important;
  bottom: 0 !important;
  right: 0 !important;
  z-index: 3 !important;
  background: rgba(255, 255, 255, 0.8) !important;
  padding: 2px 4px !important;
  font-size: 10px !important;
}

</style>
