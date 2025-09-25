<template>
  <div :class="$attrs.class" class="location-input-container">
    <!-- Main location input -->
    <q-input
      ref="locationInputRef"
      data-cy="location-input"
      :label="label"
      :placeholder="placeholder || 'Enter city, address, or use current location'"
      :hint="hint"
      :model-value="displayValue"
      :filled="filled"
      :outlined="outlined"
      :rules="rules"
      :loading="loading"
      @update:model-value="onInputChange"
      @focus="onInputFocus"
      @blur="onInputBlur"
    >
      <template v-slot:prepend>
        <q-icon
          :name="getLocationIcon()"
          :color="getLocationIconColor()"
        >
          <q-tooltip v-if="currentLocation.lat === 0 && currentLocation.lon === 0 && currentLocation.location">
            Custom location (no GPS coordinates)
          </q-tooltip>
        </q-icon>
      </template>
      <template v-slot:append>
        <q-btn
          v-if="!location"
          flat
          dense
          round
          icon="sym_r_my_location"
          @click="useCurrentLocation"
          :loading="geoLoading"
          class="q-mr-xs"
        >
          <q-tooltip>Use current location</q-tooltip>
        </q-btn>
        <q-btn
          flat
          dense
          round
          icon="sym_r_map"
          @click="openMapDialog"
          class="q-mr-xs"
        >
          <q-tooltip>Select on map</q-tooltip>
        </q-btn>
        <q-btn
          v-if="(searchQuery || currentLocation.location) && clearable"
          flat
          dense
          round
          icon="sym_r_close"
          @click="onClear"
        >
          <q-tooltip>Clear location</q-tooltip>
        </q-btn>
      </template>
    </q-input>

    <!-- Location suggestions dropdown -->
    <q-menu
      ref="suggestionsMenuRef"
      v-model="showSuggestions"
      no-focus
      no-refocus
      anchor="bottom start"
      self="top start"
      class="location-suggestions-menu"
      :offset="[0, 8]"
    >
      <q-list>
        <!-- Recent locations -->
        <template v-if="recentLocations.length > 0 && searchQuery.length < 3">
          <q-item-label header>Recent locations</q-item-label>
          <q-item
            v-for="recent in recentLocations"
            :key="recent.display_name"
            clickable
            @click="selectLocation(recent)"
            class="location-suggestion-item"
          >
            <q-item-section side>
              <q-icon name="sym_r_history" size="sm" color="grey" />
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ recent.display_name }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-separator spaced v-if="locationSuggestions.length > 0" />
        </template>

        <!-- Search suggestions -->
        <template v-if="locationSuggestions.length > 0">
          <q-item
            v-for="suggestion in locationSuggestions"
            :key="suggestion.display_name"
            clickable
            @click="selectLocation(suggestion)"
            class="location-suggestion-item"
          >
            <q-item-section side>
              <q-icon name="sym_r_location_on" size="sm" color="primary" />
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ suggestion.display_name }}</q-item-label>
            </q-item-section>
          </q-item>
        </template>

        <!-- Use custom location option when no results -->
        <q-item
          v-if="searchQuery.length >= 3 && locationSuggestions.length === 0 && !loading"
          clickable
          @click="useCustomLocation"
          class="location-suggestion-item custom-location-item"
        >
          <q-item-section side>
            <q-icon name="sym_r_edit_location" size="sm" color="secondary" />
          </q-item-section>
          <q-item-section>
            <q-item-label>Use "{{ searchQuery }}" as custom location</q-item-label>
            <q-item-label caption>Perfect for informal meeting spots</q-item-label>
          </q-item-section>
        </q-item>

        <!-- Custom location option when there are suggestions -->
        <template v-if="searchQuery.length >= 3 && locationSuggestions.length > 0">
          <q-separator spaced />
          <q-item clickable @click="useCustomLocation" class="location-suggestion-item custom-location-item">
            <q-item-section side>
              <q-icon name="sym_r_edit_location" size="sm" color="secondary" />
            </q-item-section>
            <q-item-section>
              <q-item-label>Use "{{ searchQuery }}" as custom location</q-item-label>
              <q-item-label caption>For informal or specific meeting spots</q-item-label>
            </q-item-section>
          </q-item>
        </template>

        <!-- Map selection option -->
        <template v-if="searchQuery.length >= 3 || locationSuggestions.length > 0">
          <q-separator spaced />
          <q-item clickable @click="openMapDialog" class="location-suggestion-item">
            <q-item-section side>
              <q-icon name="sym_r_map" size="sm" color="secondary" />
            </q-item-section>
            <q-item-section>
              <q-item-label>Select on map</q-item-label>
            </q-item-section>
          </q-item>
        </template>
      </q-list>
    </q-menu>

    <!-- Map selection dialog -->
    <q-dialog v-model="showMapDialog" :breakpoint="600">
      <q-card class="full-width" style="max-width: 700px">
        <q-card-section>
          <div class="text-h6">Select location on map</div>
          <div class="text-body2 text-grey-7">Click on the map to set your location</div>
        </q-card-section>
        <q-card-section>
          <div style="height: 400px">
            <LeafletMapComponent
              @markerLocation="onMarkerLocation"
              :lat="tempLocation.lat || 0"
              :lon="tempLocation.lon || 0"
            />
          </div>
        </q-card-section>
        <q-card-section v-if="tempLocation.location">
          <q-input
            v-model="tempLocation.location"
            label="Location name"
            filled
            :rules="[(val: string) => !!val || 'Please enter a location name']"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" @click="closeMapDialog" />
          <q-btn
            color="primary"
            label="Confirm Location"
            @click="confirmMapLocation"
            :disable="!tempLocation.location"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script lang="ts" setup>
import { defineEmits, ref, computed, onMounted, nextTick } from 'vue'
import axios from 'axios'
import { useNotification } from '../../composables/useNotification'
import { AddressLocation, OSMLocationSuggestion } from '../../types'
import LeafletMapComponent from '../../components/common/LeafletMapComponent.vue'
import { QInput, QMenu, ValidationRule } from 'quasar'

const { error } = useNotification()

interface Props {
  label?: string
  location?: string
  placeholder?: string
  hint?: string
  lat?: number
  lon?: number
  rules?: ValidationRule[]
  filled?: boolean
  outlined?: boolean
  clearable?: boolean
  hideSearchIcon?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  filled: true,
  hideSearchIcon: false,
  clearable: true
})

const emit = defineEmits(['update:model-value'])

// Refs
const locationInputRef = ref<QInput | null>(null)
const suggestionsMenuRef = ref<QMenu | null>(null)

// State
const searchQuery = ref<string>('')
const locationSuggestions = ref<OSMLocationSuggestion[]>([])
const recentLocations = ref<OSMLocationSuggestion[]>([])
const showSuggestions = ref<boolean>(false)
const showMapDialog = ref<boolean>(false)
const loading = ref<boolean>(false)
const geoLoading = ref<boolean>(false)

// Current location state
const currentLocation = ref<AddressLocation>({
  location: props.location || '',
  lat: Number(props.lat) || 0,
  lon: Number(props.lon) || 0
})

// Temporary location for map selection
const tempLocation = ref<AddressLocation>({
  location: '',
  lat: 0,
  lon: 0
})

// Computed display value
const displayValue = computed(() => {
  // If we have a search query, show that; otherwise show the selected location
  return searchQuery.value || currentLocation.value.location
})

// Debounced search timeout
let searchTimeout: ReturnType<typeof setTimeout> | null = null

// Load recent locations from localStorage
const loadRecentLocations = () => {
  try {
    const stored = localStorage.getItem('recent-locations')
    if (stored) {
      recentLocations.value = JSON.parse(stored).slice(0, 3) // Show max 3 recent
    }
  } catch (err) {
    console.warn('Failed to load recent locations:', err)
  }
}

// Save location to recent searches
const saveToRecentLocations = (location: OSMLocationSuggestion) => {
  try {
    const recent = recentLocations.value.filter(r => r.display_name !== location.display_name)
    recent.unshift(location)
    recentLocations.value = recent.slice(0, 5) // Keep max 5
    localStorage.setItem('recent-locations', JSON.stringify(recentLocations.value))
  } catch (err) {
    console.warn('Failed to save recent location:', err)
  }
}

// Input handlers
const onInputChange = (value: string) => {
  searchQuery.value = value

  // Clear search timeout
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }

  // If input is cleared, reset location
  if (!value.trim()) {
    currentLocation.value = { location: '', lat: 0, lon: 0 }
    locationSuggestions.value = []
    emit('update:model-value', currentLocation.value)
    return
  }

  // If user is typing and it doesn't match the current location, clear the current location
  if (value !== currentLocation.value.location && currentLocation.value.location) {
    currentLocation.value = { location: '', lat: 0, lon: 0 }
  }

  // Debounced search - but also support custom locations
  searchTimeout = setTimeout(() => {
    if (value.length >= 3) {
      fetchLocationSuggestions(value)
    }
  }, 300)
}

// Handle custom/informal location input
const useCustomLocation = () => {
  if (!searchQuery.value.trim()) return

  const customLocationData = {
    location: searchQuery.value.trim(),
    lat: 0, // No coordinates for custom locations
    lon: 0
  }

  currentLocation.value = customLocationData
  searchQuery.value = '' // Clear search query to show selected location
  locationSuggestions.value = []
  showSuggestions.value = false

  emit('update:model-value', customLocationData)

  // Save to recent locations as a custom entry
  saveToRecentLocations({
    display_name: customLocationData.location,
    lat: '0',
    lon: '0'
  })

  // Blur the input to hide the keyboard on mobile
  if (locationInputRef.value) {
    locationInputRef.value.blur()
  }
}

const onInputFocus = () => {
  showSuggestions.value = true
  if (searchQuery.value.length >= 3) {
    fetchLocationSuggestions(searchQuery.value)
  }
}

const onInputBlur = () => {
  // Delay hiding to allow menu clicks
  setTimeout(() => {
    showSuggestions.value = false
  }, 200)
}

// Geolocation
const useCurrentLocation = async () => {
  if (!navigator.geolocation) {
    error('Geolocation is not supported by this browser')
    return
  }

  geoLoading.value = true

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      try {
        const { latitude, longitude } = position.coords
        const response = await axios.get(
          `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
        )

        const locationData = {
          location: response.data.display_name,
          lat: latitude,
          lon: longitude
        }

        currentLocation.value = locationData
        searchQuery.value = '' // Clear search query to show selected location
        emit('update:model-value', locationData)

        // Save to recent locations
        saveToRecentLocations({
          display_name: response.data.display_name,
          lat: latitude.toString(),
          lon: longitude.toString()
        })
      } catch (err) {
        console.error('Error getting location name:', err)
        error('Failed to get location name')
      } finally {
        geoLoading.value = false
      }
    },
    (err) => {
      geoLoading.value = false
      console.error('Geolocation error:', err)
      error('Failed to get your location. Please check your browser permissions.')
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 300000 // 5 minutes
    }
  )
}

// Map selection
const openMapDialog = () => {
  tempLocation.value = {
    location: currentLocation.value.location,
    lat: currentLocation.value.lat || 0,
    lon: currentLocation.value.lon || 0
  }
  showMapDialog.value = true
}

const closeMapDialog = () => {
  showMapDialog.value = false
  tempLocation.value = { location: '', lat: 0, lon: 0 }
}

const onMarkerLocation = async (location: { lat: number, lng: number }) => {
  try {
    const response = await axios.get(
      `https://nominatim.openstreetmap.org/reverse?lat=${location.lat}&lon=${location.lng}&format=json`
    )
    tempLocation.value = {
      location: response.data.display_name,
      lat: location.lat,
      lon: location.lng
    }
  } catch (err) {
    console.error('Error getting location name:', err)
    tempLocation.value = {
      location: `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`,
      lat: location.lat,
      lon: location.lng
    }
  }
}

const confirmMapLocation = () => {
  if (tempLocation.value.location) {
    currentLocation.value = { ...tempLocation.value }
    searchQuery.value = '' // Clear search query to show selected location
    emit('update:model-value', currentLocation.value)

    // Save to recent locations
    saveToRecentLocations({
      display_name: tempLocation.value.location,
      lat: tempLocation.value.lat.toString(),
      lon: tempLocation.value.lon.toString()
    })

    closeMapDialog()
  }
}

const onClear = () => {
  searchQuery.value = ''
  currentLocation.value = { location: '', lat: 0, lon: 0 }
  locationSuggestions.value = []
  emit('update:model-value', currentLocation.value)
}

const fetchLocationSuggestions = async (search: string) => {
  if (search.length < 3) {
    locationSuggestions.value = []
    return
  }

  try {
    loading.value = true
    const response = await axios.get(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(search)}&format=json&limit=5&accept-language=en`
    )
    locationSuggestions.value = response.data

    if (showSuggestions.value) {
      await nextTick()
      suggestionsMenuRef.value?.updatePosition()
    }
  } catch (err) {
    console.error('Error fetching location suggestions:', err)
    error('Failed to fetch location suggestions')
    locationSuggestions.value = []
  } finally {
    loading.value = false
  }
}

const selectLocation = (suggestion: OSMLocationSuggestion) => {
  const locationData = {
    location: suggestion.display_name || '',
    lat: parseFloat(suggestion.lat as string),
    lon: parseFloat(suggestion.lon as string)
  }

  currentLocation.value = locationData
  searchQuery.value = '' // Clear the search query so display shows the selected location
  locationSuggestions.value = []
  showSuggestions.value = false

  emit('update:model-value', locationData)

  // Save to recent locations
  saveToRecentLocations(suggestion)

  // Blur the input to hide the keyboard on mobile
  if (locationInputRef.value) {
    locationInputRef.value.blur()
  }
}

// Helper functions for location icon and color
const getLocationIcon = () => {
  if (!currentLocation.value.location) {
    return 'sym_r_location_searching'
  }
  // Custom location (no coordinates)
  if (currentLocation.value.lat === 0 && currentLocation.value.lon === 0) {
    return 'sym_r_edit_location'
  }
  // Regular location with coordinates
  return 'sym_r_location_on'
}

const getLocationIconColor = () => {
  if (!currentLocation.value.location) {
    return 'grey'
  }
  // Custom location
  if (currentLocation.value.lat === 0 && currentLocation.value.lon === 0) {
    return 'secondary'
  }
  // Regular location
  return 'primary'
}

// Initialize component
onMounted(() => {
  loadRecentLocations()

  // Set initial location if provided
  if (props.location) {
    currentLocation.value = {
      location: props.location,
      lat: Number(props.lat) || 0,
      lon: Number(props.lon) || 0
    }
  }
})
</script>

<style scoped>
.location-input-container {
  width: 100%;
  position: relative;
}

.location-suggestions-menu {
  min-width: 300px;
  max-width: 500px;
}

.location-suggestion-item {
  padding: 8px 16px;

  &:hover {
    background-color: rgba(0, 0, 0, 0.04);
  }

  :deep(.q-dark) &:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }
}

.location-suggestion-item .q-item-section--side {
  min-width: 32px;
}

.custom-location-item {
  background-color: rgba(0, 0, 0, 0.02);
  border-left: 3px solid var(--q-secondary);

  :deep(.q-dark) & {
    background-color: rgba(255, 255, 255, 0.05);
  }

  &:hover {
    background-color: rgba(0, 0, 0, 0.06);
  }

  :deep(.q-dark) &:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }
}
</style>
