<template>
  <q-input
    model-value=""
    :label="label"
    filled
  >
    <template v-slot:append>
      <q-icon
        name="sym_r_place"
        @click="openPopup"
        class="cursor-pointer"
      />
      <q-icon
        name="sym_r_my_location"
        @click="getCurrentLocation"
        class="cursor-pointer"
      />
    </template>
  </q-input>

  <q-dialog v-model="dialog">
    <q-card>
      <q-card-section>
        <div>
          <h4 class="q-my-none">Fill in the Location Details</h4>
<!--          <q-input v-model="location.address" label="Address" required />-->
<!--          <q-input v-model="location.city" label="City" required />-->
<!--          <q-input v-model="location.country" label="Country" required />-->
<!--          <q-input v-model.number="location.latitude" label="Latitude" type="number"/>-->
<!--          <q-input v-model.number="location.longitude" label="Longitude" type="number"/>-->
        </div>
      </q-card-section>
      <q-card-actions>
        <q-btn label="Save" color="primary" @click="saveLocation" />
        <q-btn label="Cancel" @click="closePopup" v-close-popup />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script lang="ts" setup>
import { ref, defineProps, watch } from 'vue'
import { Location } from 'src/types'

const props = defineProps<{
  modelValue: Location | undefined; // Ensure your Location type includes latitude and longitude
  label: string
}>()

// eslint-disable-next-line func-call-spacing
// const emit = defineEmits<{
//   (e: 'update:modelValue', value: Location): void;
// }>()

const dialog = ref<boolean>(false)
// const location = ref<Location | undefined>(props.modelValue)

// Watch for changes in the prop and update the internal state
watch(
  () => props.modelValue,
  (newValue) => {
    console.log(newValue)
    // location.value = { ...newValue }
  }
)

const openPopup = () => {
  dialog.value = true
}

const closePopup = () => {
  dialog.value = false
}

const saveLocation = () => {
  // emit('update:modelValue', location.value) // Emit the updated location
  closePopup()
}

const getCurrentLocation = () => {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log(position)
        // location.value.latitude = position.coords.latitude
        // location.value.longitude = position.coords.longitude
        // Optionally, you can implement reverse geocoding here
      },
      (error) => {
        console.error('Error obtaining location', error)
      }
    )
  } else {
    console.error('Geolocation is not supported by this browser.')
  }
}
</script>

<style scoped>
/* Add any additional styling here */
</style>
