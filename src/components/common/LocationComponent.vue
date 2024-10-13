<template>
  <div :class="$attrs.class" class="relative relative-position">
    <q-select
      ref="selectRef"
      :label="label"
      :placeholder="placeholder"
      :model-value="location"
      :filled="filled"
      :outlined="outlined"
      debounce="500"
      :rules="rules"
      :clearable="clearable"
      @clear="onClear"
      use-input
      option-label="display_name"
      hide-dropdown-icon
      :loading="loading"
      @update:model-value="selectLocation"
      :options="locationSuggestions"
      @blur="locationSuggestions = []"
      @input-value="fetchLocationSuggestions"
    >
      <template v-slot:selected>
        <span class="text-no-wrap overflow-hidden ellipsis" style="max-width: 70%">{{ location }}</span>
      </template>
      <template v-slot:append>
        <q-icon name="sym_r_search"/>
      </template>
      <template v-slot:prepend>
        <q-icon :name="'sym_r_map'" @mousedown.stop="openProxyDialog"/>
      </template>
      <template v-slot:before-options>
        <MenuItemComponent icon="sym_r_add_location_alt" @click="openProxyDialog" label="Add a New Address"/>
      </template>
      <template v-slot:no-option>
        <MenuItemComponent icon="sym_r_add_location_alt" @click="openProxyDialog" label="Add a New Address"/>
      </template>
      <template v-slot:option="scope">
        <q-item class="wrap" v-bind="scope.itemProps">
          <q-item-section side>
            <q-icon name="sym_r_line_start_circle" />
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ scope.label }}</q-item-label>
          </q-item-section>
        </q-item>
      </template>
    </q-select>

<!--    <q-list :class="[Dark.isActive ? 'bg-dark' : 'bg-white','absolute absolute-left absolute-right']" bordered v-if="searchQuery.length > 3" style="z-index: 1">-->
<!--    <q-list bordered v-if="searchQuery.length > 3">-->
<!--      <MenuItemComponent v-for="(suggestion, index) in locationSuggestions" :key="index"-->
<!--                         @click="selectLocation(suggestion)" :label="suggestion.display_name"/>-->
<!--      <MenuItemComponent icon="sym_r_add_location_alt" @click="openProxyDialog" label="Add a New Address"/>-->
<!--    </q-list>-->

    <!-- QPopupProxy for adding new location -->
    <q-dialog v-model="showPopup" :breakpoint="600">
      <q-card class="full-width" style="max-width: 600px">
        <q-form ref="newAddressRef" @submit.prevent="addNewLocation">
          <q-card-section>
            <div class="text-h6">Set new location</div>
          </q-card-section>
          <q-card-section v-if="'test'">
            <q-input v-model="newLocation.location" :rules="[(val: string) => !!val || 'Please enter address']"
                     label="Input location name" filled/>
          </q-card-section>
          <q-card-section>
            <div style="height: 300px">
              <span class="text-body2">Click on the map to set coordinates</span>
              <LeafletMapComponent @markerLocation="onMarkerLocation" :lat="newLocation.lat"
                                   :lon="newLocation.lon"/>
            </div>
          </q-card-section>
          <q-card-actions class="q-mt-md" align="right">
            <q-btn no-caps flat label="Cancel" @click="showPopup = false"/>
            <q-btn no-caps label="Confirm" type="submit" color="primary" @click="addNewLocation"/>
          </q-card-actions>
        </q-form>
      </q-card>
    </q-dialog>
  </div>
</template>

<script lang="ts" setup>
import { defineEmits, ref } from 'vue'
import axios from 'axios'
import { useNotification } from 'src/composables/useNotification.ts'
import { AddressLocation, OSMLocationSuggestion } from 'src/types'
import MenuItemComponent from 'components/common/MenuItemComponent.vue'
import LeafletMapComponent from 'components/common/LeafletMapComponent.vue'
import { QSelect, ValidationRule } from 'quasar'

const { error } = useNotification()

interface Props {
  label?: string
  location?: string
  placeholder?: string
  lat?: number
  lon?: number
  rules?: ValidationRule[]
  filled?: boolean
  outlined?: boolean
  clearable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  filled: true
})

const emit = defineEmits(['update:model-value'])

const searchQuery = ref<string>('')
const locationSuggestions = ref<OSMLocationSuggestion[]>([])
const showPopup = ref<boolean>(false)
const newLocation = ref<AddressLocation>({
  location: props.location || '',
  lat: Number(props.lat) || 0,
  lon: Number(props.lon) || 0
})
const loading = ref<boolean>(false)
const selectRef = ref<QSelect | null>(null)

const onMarkerLocation = async (location: { lat: number, lng: number }) => {
  await axios.get(`https://nominatim.openstreetmap.org/reverse?lat=${location.lat}&lon=${location.lng}&&format=json`).then(res => {
    newLocation.value.location = res.data.display_name
  }).finally(() => {
    newLocation.value.lat = location.lat
    newLocation.value.lon = location.lng
  })
}

const openProxyDialog = () => {
  showPopup.value = true
}

const addNewLocation = () => {
  emit('update:model-value', newLocation.value)
  showPopup.value = false
}

const onClear = () => {
  emit('update:model-value', { location: '', lat: 0, lon: 0 })
}

const fetchLocationSuggestions = async (search: string | number | null) => {
  searchQuery.value = search ? String(search) : ''
  if (searchQuery.value.length < 3) return

  try {
    loading.value = true
    // const response = await axios.get(`https://nominatim.openstreetmap.org/search?q=${searchQuery.value}&format=json&addressdetails=1&limit=5&accept-language=en`)
    const response = await axios.get(`https://nominatim.openstreetmap.org/search?q=${searchQuery.value}&format=json&limit=5&accept-language=en`)
    locationSuggestions.value = response.data
  } catch (err) {
    console.log('Error fetching location suggestions:', err)
    error('Error fetching location')
  } finally {
    loading.value = false
    selectRef.value?.showPopup()
  }
}

const selectLocation = (suggestion: OSMLocationSuggestion | null) => {
  if (!suggestion) return
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
