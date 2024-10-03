<template>
  <q-input filled v-model="formattedDate" readonly :required="required">
    <!-- Date picker -->
    <template v-slot:prepend>
      <q-icon name="sym_r_event" class="cursor-pointer">
        <q-popup-proxy cover transition-show="scale" transition-hide="scale">
          <q-date v-model="tempDate" mask="YYYY-MM-DD" @update:model-value="onDateUpdate">
            <div class="row items-center justify-end">
              <q-btn v-close-popup label="Close" color="primary" flat />
            </div>
          </q-date>
        </q-popup-proxy>
      </q-icon>
    </template>

    <!-- Time picker -->
    <template v-slot:append>
      <q-icon name="sym_r_access_time" class="cursor-pointer">
        <q-popup-proxy cover transition-show="scale" transition-hide="scale">
          <q-time v-model="tempTime" format24h @update:model-value="onTimeUpdate">
            <div class="row items-center justify-end">
              <q-btn v-close-popup label="Close" color="primary" flat />
            </div>
          </q-time>
        </q-popup-proxy>
      </q-icon>
    </template>

    <!-- Display Timezone -->
    <template v-slot:after>
      <div class="text-overline text-bold">
        {{ Intl.DateTimeFormat().resolvedOptions().timeZone }}
      </div>
    </template>
  </q-input>
</template>

<script lang="ts" setup>
import { ref, computed, watch, defineProps, defineEmits } from 'vue'

// Define props and emit event
const props = defineProps({
  required: Boolean,
  modelValue: {
    type: String,
    required: true
  }
})
const emit = defineEmits(['update:model-value'])

// State variables for the component
const tempDate = ref<string | null>(null)
const tempTime = ref<string | null>(null)
const date = ref<string>(props.modelValue)

// Watch the parent modelValue and update date and time
watch(() => props.modelValue, (newVal) => {
  date.value = newVal
  updateTempValuesFromISO()
})

// Extract date and time from ISO string for q-date and q-time
const updateTempValuesFromISO = () => {
  if (date.value) {
    const [datePart, timePart] = date.value.split('T')
    tempDate.value = datePart
    tempTime.value = timePart?.slice(0, 5) || '' // Extract "HH:mm"
  }
}

// const formatDate = (date) => {
//   return new Date(date).toISOString().substring(0, 16)
// }

// Format the selected date and time into a readable format for the input
const formattedDate = computed(() => date.value ? new Date(date.value).toLocaleString() : '')

// Update the date portion when a new date is selected
const onDateUpdate = (newDate: string) => {
  // console.log('newDate', newDate)
  tempDate.value = newDate
  updateDateTime()
}

// Update the time portion when a new time is selected
const onTimeUpdate = (newTime: string) => {
  // console.log('newTime', newTime)
  tempTime.value = newTime
  updateDateTime()
}

// Combine the selected date and time into an ISO string and emit to parent
const updateDateTime = () => {
  if (tempDate.value && tempTime.value) {
    const dateTimeString = `${tempDate.value}T${tempTime.value}:00`
    // console.log('dateTimeString', dateTimeString)
    // date.value = new Date(dateTimeString).toISOString()
    // emit('update:model-value', date.value)
    emit('update:model-value', new Date(dateTimeString).toISOString())
  } else {
    const currentDate = tempDate.value || new Date().toISOString().split('T')[0]
    const currentTime = tempTime.value || '00:00'
    const dateTimeString = `${currentDate}T${currentTime}:00`
    // console.log('dateTimeStringElse', dateTimeString, currentDate, currentTime)
    emit('update:model-value', new Date(dateTimeString).toISOString())
  }
}

// Initialize the date and time on component mount
updateTempValuesFromISO()
</script>

<style scoped>
/* Optional styling */
</style>
