<template>
  <div class="c-update-future-occurrences-component">
    <q-card>
      <q-card-section>
        <div class="text-h6 q-mb-md">
          <q-icon name="sym_r_update" class="q-mr-sm" />
          Update Future Occurrences
        </div>

        <p>
          Choose the date from which you want to update all future occurrences of this series.
          Changes will affect all events on or after the selected date.
        </p>

        <q-form ref="formRef" @submit="onSubmit" class="q-gutter-md">
          <!-- From Date -->
          <div class="q-mb-md">
            <div class="text-subtitle2 q-mb-sm">Update from date</div>
            <DatetimeComponent
              data-cy="from-date"
              required
              label="Starting from this date"
              v-model="fromDate"
              :timeZone="timeZone"
              :min-date="today"
              :rules="[(val) => !!val || 'Date is required']"
            />
          </div>

          <!-- Update Fields -->
          <div class="q-mb-md">
            <div class="text-subtitle2 q-mb-sm">Properties to update</div>

            <!-- Location -->
            <div class="q-mb-md" v-if="eventType !== 'online'">
              <q-checkbox v-model="updateFields.location" label="Update location" />
              <q-input
                v-if="updateFields.location"
                data-cy="update-location"
                v-model="updateData.location"
                filled
                label="New physical location"
                class="q-mt-sm"
                :rules="[(val) => !!val || 'Location is required']"
              />
            </div>

            <!-- Online Location -->
            <div class="q-mb-md" v-if="eventType !== 'in-person'">
              <q-checkbox v-model="updateFields.locationOnline" label="Update online location" />
              <q-input
                v-if="updateFields.locationOnline"
                data-cy="update-location-online"
                v-model="updateData.locationOnline"
                filled
                label="New online meeting link"
                class="q-mt-sm"
                :rules="[(val) => !!val || 'Online location is required']"
              />
            </div>

            <!-- Description -->
            <div class="q-mb-md">
              <q-checkbox v-model="updateFields.description" label="Update description" />
              <q-input
                v-if="updateFields.description"
                data-cy="update-description"
                v-model="updateData.description"
                filled
                type="textarea"
                autogrow
                label="New description"
                class="q-mt-sm"
                :rules="[(val) => !!val || 'Description is required']"
              />
            </div>

            <!-- Max Attendees -->
            <div class="q-mb-md">
              <q-checkbox v-model="updateFields.maxAttendees" label="Update max attendees" />
              <q-input
                v-if="updateFields.maxAttendees"
                data-cy="update-max-attendees"
                v-model.number="updateData.maxAttendees"
                type="number"
                filled
                label="New maximum attendees (0 for unlimited)"
                min="0"
                class="q-mt-sm"
                :rules="[(val) => val >= 0 || 'Must be at least 0']"
              />
            </div>

            <!-- Approval -->
            <div class="q-mb-md">
              <q-checkbox v-model="updateFields.requireApproval" label="Update approval settings" />
              <div v-if="updateFields.requireApproval" class="q-mt-sm">
                <q-checkbox v-model="updateData.requireApproval" label="Require approval for attendees" />
                <q-input
                  v-if="updateData.requireApproval"
                  data-cy="update-approval-question"
                  v-model="updateData.approvalQuestion"
                  filled
                  label="New question for attendees"
                  placeholder="Why do you want to attend this event?"
                  class="q-mt-sm"
                  :rules="[(val) => !!val || 'Approval question is required']"
                />
              </div>
            </div>

            <!-- Waitlist -->
            <div class="q-mb-md">
              <q-checkbox v-model="updateFields.allowWaitlist" label="Update waitlist setting" />
              <div v-if="updateFields.allowWaitlist" class="q-mt-sm">
                <q-checkbox v-model="updateData.allowWaitlist" label="Allow waitlist when event is full" />
              </div>
            </div>
          </div>

          <!-- Submit Button -->
          <div class="row justify-between">
            <q-btn flat type="button" label="Cancel" @click="$emit('cancel')" />
            <q-btn
              data-cy="update-submit"
              type="submit"
              color="primary"
              label="Update Future Occurrences"
              :disabled="!hasChanges"
            />
          </div>
        </q-form>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import DatetimeComponent from '../common/DatetimeComponent.vue'
import { EventSeriesService } from '../../services/eventSeriesService'
import { useQuasar } from 'quasar'
import { format } from 'date-fns'
import { EventType } from '../../types'

const props = defineProps({
  seriesSlug: {
    type: String,
    required: true
  },
  timeZone: {
    type: String,
    default: 'UTC'
  },
  eventType: {
    type: String,
    default: EventType.InPerson
  }
})

const emit = defineEmits(['updated', 'cancel'])

const $q = useQuasar()
const formRef = ref(null)
const isLoading = ref(false)
const today = ref(new Date().toISOString())
const fromDate = ref(today.value)

// Fields to update
const updateFields = ref({
  location: false,
  locationOnline: false,
  description: false,
  maxAttendees: false,
  requireApproval: false,
  allowWaitlist: false
})

// Update data
const updateData = ref({
  location: '',
  locationOnline: '',
  description: '',
  maxAttendees: 0,
  requireApproval: false,
  approvalQuestion: '',
  allowWaitlist: false
})

// Computed
const hasChanges = computed(() => {
  return (
    (updateFields.value.location && updateData.value.location) ||
    (updateFields.value.locationOnline && updateData.value.locationOnline) ||
    (updateFields.value.description && updateData.value.description) ||
    (updateFields.value.maxAttendees) ||
    (updateFields.value.requireApproval) ||
    (updateFields.value.allowWaitlist)
  )
})

const onSubmit = async () => {
  if (!hasChanges.value) {
    $q.notify({
      type: 'warning',
      message: 'No changes to apply to future occurrences'
    })
    return
  }

  try {
    isLoading.value = true

    // Build update payload
    const updates: Record<string, string | number | boolean> = {}

    if (updateFields.value.location) {
      updates.location = updateData.value.location
    }

    if (updateFields.value.locationOnline) {
      updates.locationOnline = updateData.value.locationOnline
    }

    if (updateFields.value.description) {
      updates.description = updateData.value.description
    }

    if (updateFields.value.maxAttendees) {
      updates.maxAttendees = updateData.value.maxAttendees
    }

    if (updateFields.value.requireApproval) {
      updates.requireApproval = updateData.value.requireApproval
      if (updateData.value.requireApproval) {
        updates.approvalQuestion = updateData.value.approvalQuestion
      }
    }

    if (updateFields.value.allowWaitlist) {
      updates.allowWaitlist = updateData.value.allowWaitlist
    }

    // Format date for API
    const formattedDate = format(new Date(fromDate.value), 'yyyy-MM-dd')

    // Make sure we're using direct property names, not template-prefixed ones
    // Log the updates we're sending to the API
    console.log('Sending updates to API:', updates)

    // Call API
    const result = await EventSeriesService.updateFutureOccurrences(
      props.seriesSlug,
      formattedDate,
      updates
    )

    // Show success notification
    $q.notify({
      type: 'positive',
      message: `Updated ${result.count} future occurrences successfully!`
    })

    // Emit success
    emit('updated', result)
  } catch (error) {
    console.error('Error updating future occurrences:', error)
    $q.notify({
      type: 'negative',
      message: `Failed to update future occurrences: ${error.message || 'Unknown error'}`
    })
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
.c-update-future-occurrences-component {
  width: 100%;
}
</style>
