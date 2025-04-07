<template>
  <q-dialog :model-value="isOpen" @update:model-value="val => emit('update:isOpen', val)" persistent>
    <q-card style="min-width: 400px; max-width: 800px">
      <q-card-section class="row items-center">
        <div class="text-h6">Split Recurring Series</div>
        <q-space />
        <q-btn icon="sym_r_close" flat round dense v-close-popup />
      </q-card-section>

      <q-card-section>
        <p>
          You are about to split the recurring event series
          <strong>{{ event?.name }}</strong>.
          The series will be divided into two separate series at the date you select.
        </p>

        <div class="q-mt-md">
          <q-input
            v-model="splitDate"
            filled
            type="date"
            label="Split from date"
            hint="Select the date to start the new series"
            :rules="[val => !!val || 'Please select a date']"
          >
            <template v-slot:append>
              <q-icon name="sym_r_event" class="cursor-pointer">
                <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                  <q-date v-model="splitDate" mask="YYYY-MM-DD">
                    <div class="row items-center justify-end">
                      <q-btn v-close-popup label="Close" color="primary" flat />
                    </div>
                  </q-date>
                </q-popup-proxy>
              </q-icon>
            </template>
          </q-input>
        </div>

        <div class="q-mt-md">
          <q-checkbox
            v-model="modifyFutureEvents"
            label="Modify future events"
          />
        </div>

        <div v-if="modifyFutureEvents" class="q-mt-md q-pa-md bg-grey-2 rounded-borders">
          <div class="text-subtitle2 q-mb-md">Modifications for future events</div>

          <div class="row q-col-gutter-md">
            <div class="col-12 col-sm-6">
              <q-input
                v-model="modifications.name"
                filled
                label="Event Name"
                :hint="event?.name ? 'Original: ' + event.name : ''"
              />
            </div>

            <div class="col-12 col-sm-6">
              <q-select
                v-model="modifications.type"
                :options="eventTypeOptions"
                filled
                label="Event Type"
                :hint="event?.type ? 'Original: ' + event.type : ''"
                emit-value
                map-options
              />
            </div>
          </div>

          <div class="row q-col-gutter-md q-mt-md">
            <div class="col-12">
              <q-input
                v-model="modifications.description"
                filled
                type="textarea"
                label="Description"
                :hint="event?.description ? 'Original description will be preserved if empty' : ''"
                rows="4"
              />
            </div>
          </div>

          <div class="row q-col-gutter-md q-mt-md">
            <div class="col-12 col-sm-6">
              <q-input
                v-model="modifications.location"
                filled
                label="Location"
                :hint="event?.location ? 'Original: ' + event.location : ''"
              />
            </div>

            <div class="col-12 col-sm-6">
              <q-input
                v-model="modifications.locationOnline"
                filled
                label="Online Meeting Link"
                :hint="event?.locationOnline ? 'Original: ' + event.locationOnline : ''"
              />
            </div>
          </div>
        </div>
      </q-card-section>

      <q-card-section class="text-grey-7 text-body2">
        <q-icon name="sym_r_info" size="sm" class="q-mr-xs" />
        Once split, the original series will end before the split date, and a new series
        will begin on the split date. This operation cannot be undone.
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Cancel" color="primary" v-close-popup />
        <q-btn
          label="Split Series"
          color="primary"
          :loading="isSplitting"
          :disable="!splitDate || isSplitting"
          @click="splitSeries"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { EventEntity, EventType } from '../../types/event'
import { RecurrenceService } from '../../services/recurrenceService'
import { useNotification } from '../../composables/useNotification'

const props = defineProps<{
  isOpen: boolean
  event: EventEntity | null
}>()

const emit = defineEmits(['update:isOpen', 'series-split'])

const router = useRouter()
const { success, error } = useNotification()

// Form state
const splitDate = ref('')
const modifyFutureEvents = ref(false)
const modifications = ref<Partial<EventEntity>>({})
const isSplitting = ref(false)

// Event type options for the form
const eventTypeOptions = [
  { label: 'In Person', value: EventType.InPerson },
  { label: 'Online', value: EventType.Online },
  { label: 'Hybrid', value: EventType.Hybrid }
]

// Methods
const splitSeries = async () => {
  if (!props.event || !splitDate.value || isSplitting.value) return

  isSplitting.value = true

  try {
    // Format date with time from event start
    const eventStartTime = new Date(props.event.startDate).toISOString().substr(11, 8)
    const fullSplitDate = `${splitDate.value}T${eventStartTime}`

    // Only include modifications if enabled
    const modsToApply = modifyFutureEvents.value ? modifications.value : {}

    const result = await RecurrenceService.splitSeriesAt(
      props.event.slug,
      fullSplitDate,
      modsToApply
    )

    if (result) {
      success('Series split successfully')
      emit('series-split', result)

      // Close the dialog
      emit('update:isOpen', false)

      // Navigate to the new series
      router.push({ name: 'EventPage', params: { slug: result.slug } })
    } else {
      error('Failed to split series')
    }
  } catch (err) {
    console.error('Error splitting series:', err)
    error('Failed to split series')
  } finally {
    isSplitting.value = false
  }
}

// Reset form when dialog opens
const resetForm = () => {
  splitDate.value = ''
  modifyFutureEvents.value = false
  modifications.value = {}
}

// Watch for changes in the isOpen prop
watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    resetForm()
  }
})
</script>

<style scoped>
/* Custom styling if needed */
</style>
