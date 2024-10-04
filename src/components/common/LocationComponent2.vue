<template>
  <q-input
    :label="label"
    v-model="searchQuery"
    filled
    debounce="500"
    @update:model-value="fetchLocationSuggestions"
  >
    <template v-slot:append>
      <q-icon name="sym_r_search" />
    </template>
    <template v-slot:prepend>
      <q-icon name="sym_r_place" />
    </template>
  </q-input>
  <q-list bordered v-if="locationSuggestions.length">
      <q-item
        v-for="(suggestion, index) in locationSuggestions"
        :key="index"
        clickable
        @click="selectLocation(suggestion)"
      >
        <q-item-section>
          {{ suggestion.display_name }}
        </q-item-section>
      </q-item>
    </q-list>
</template>

<script lang="ts" setup>
import { defineEmits, ref } from 'vue'
import axios from 'axios'
import { useNotification } from 'src/composables/useNotification.ts'
import { OSMLocationSuggestion } from 'src/types'

const { error } = useNotification()

interface Props {
  modelValue: string | undefined
  label?: string
}

defineProps<Props>()
const emit = defineEmits(['update:model-value'])

const searchQuery = ref<string>('')
const locationSuggestions = ref<OSMLocationSuggestion[]>([])

const fetchLocationSuggestions = async () => {
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
  searchQuery.value = suggestion.display_name || ''
  locationSuggestions.value = [] // clear suggestions after selection
  emit('update:model-value', suggestion)

  console.log('Selected Location:', suggestion)
}
</script>

<style scoped>
/* Optional styles for the component */
</style>
