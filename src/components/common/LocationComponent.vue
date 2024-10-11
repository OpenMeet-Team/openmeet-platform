<template>
  <q-input
    :label="label"
    :placeholder="placeholder"
    :model-value="location"
    filled
    debounce="500"
    :rules="rules"
    @update:model-value="fetchLocationSuggestions"
  >
    <template v-slot:append>
      <q-icon name="sym_r_search"/>
    </template>
    <template v-slot:prepend>
      <q-icon :name="'sym_r_map'" @click="openProxyDialog"/>
    </template>
  </q-input>
  <q-list bordered v-if="searchQuery.length > 3">
    <MenuItemComponent v-for="(suggestion, index) in locationSuggestions" :key="index"  @click="selectLocation(suggestion)" :label="suggestion.display_name"/>
    <MenuItemComponent icon="sym_r_add_location_alt" @click="openProxyDialog" label="Add a New Address"/>
  </q-list>

  <!-- QPopupProxy for adding new location -->
  <q-dialog v-model="showPopup" :breakpoint="600">
    <q-card class="full-width" style="max-width: 600px">
      <q-form ref="newAddressRef" @submit="addNewLocation">
        <q-card-section>
          <div class="text-h6">Add a new Address</div>
        </q-card-section>
        <q-card-section>
          <q-input v-model="newLocation.location" :rules="[(val) => !!val || 'Please enter address']" label="Enter new location" filled />
        </q-card-section>
        <q-card-section>
          <div style="height: 300px">
            Click on the map to set location
            <LeafletMapComponent @markerLocation="onMarkerLocation" :lat="newLocation.lat ?? undefined" :lon="newLocation.lon ?? undefined"/>
          </div>
        </q-card-section>
        <q-card-actions class="q-mt-md" align="right">
          <q-btn no-caps flat label="Cancel" @click="showPopup = false" />
          <q-btn no-caps label="Save Address" type="submit" color="primary" @click="addNewLocation" />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script lang="ts" setup>
import { defineEmits, ref } from 'vue'
import axios from 'axios'
import { useNotification } from 'src/composables/useNotification.ts'
import { OSMLocationSuggestion } from 'src/types'
import MenuItemComponent from 'components/common/MenuItemComponent.vue'
import LeafletMapComponent from 'components/common/LeafletMapComponent.vue'
import { ValidationRule } from 'quasar'

const { error } = useNotification()

interface Props {
  label?: string
  location?: string
  placeholder?: string
  lat?: number
  lon?: number
  rules?: ValidationRule[]
}

interface NewLocation {
  location: string
  lat: number | null
  lon: number | null
}

const props = defineProps<Props>()
const emit = defineEmits(['update:model-value'])

const searchQuery = ref<string>('')
const locationSuggestions = ref<OSMLocationSuggestion[]>([])
const showPopup = ref<boolean>(false)
const newLocation = ref<NewLocation>({
  location: props.location || '',
  lat: props.lat || 0,
  lon: props.lon || 0
})

const onMarkerLocation = (location: { lat: number, lng: number }) => {
  console.log('onMarkerLocation', location)
  newLocation.value.lat = location.lat
  newLocation.value.lon = location.lng
}

const openProxyDialog = () => {
  showPopup.value = true
}

const addNewLocation = () => {
  showPopup.value = false
  console.log('New location added:', newLocation)
  emit('update:model-value', newLocation.value)
}

const fetchLocationSuggestions = async (search: string | number | null) => {
  searchQuery.value = search ? String(search) : ''
  if (searchQuery.value.length < 3) return

  try {
    const response = await axios.get(
      `https://nominatim.openstreetmap.org/search?q=${searchQuery.value}&format=json&addressdetails=1&limit=5&accept-language=en`
    )
    locationSuggestions.value = response.data
  } catch (err) {
    console.log('Error fetching location suggestions:', err)
    error('Error fetching location')
  }
}

const selectLocation = (suggestion: OSMLocationSuggestion) => {
  searchQuery.value = ''
  locationSuggestions.value = []
  newLocation.value.location = suggestion.display_name || ''
  newLocation.value.lat = parseFloat(suggestion.lat as string)
  newLocation.value.lon = parseFloat(suggestion.lon as string)
  emit('update:model-value', newLocation.value)
}
</script>

<style scoped>
/* Optional styles for the component */
</style>
