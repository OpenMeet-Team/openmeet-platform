<template>
  <q-dialog :model-value="isOpen" @update:model-value="emit('update:is-open', $event)" persistent>
    <q-card style="min-width: 500px">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">
          <q-icon name="sym_r_event_repeat" class="q-mr-sm" />
          Promote to Recurring Event Series
        </div>
        <q-space />
        <q-btn
          icon="sym_r_close"
          flat
          round
          dense
          v-close-popup
        />
      </q-card-section>

      <q-form
        @submit="onSubmit"
        class="q-gutter-md"
      >
        <q-card-section class="q-pt-sm">
          <p class="text-body1">
            This will make your event part of a recurring series. The current event will become
            the template for all future occurrences.
          </p>

          <!-- Series Information -->
          <div class="q-mb-md">
            <q-input
              v-model="seriesName"
              label="Series Name"
              filled
              :rules="[(val) => !!val || 'Series name is required']"
            />
          </div>

          <div class="q-mb-md">
            <q-input
              v-model="seriesDescription"
              label="Series Description"
              filled
              type="textarea"
              autogrow
            />
          </div>

          <!-- Recurrence Component -->
          <div class="q-mt-md">
            <RecurrenceComponent
              v-model="recurrenceRule"
              v-model:is-recurring="isRecurring"
              v-model:time-zone="timeZone"
              :start-date="eventStartDate"
            />
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn
            label="Cancel"
            color="grey-7"
            flat
            v-close-popup
          />
          <q-btn
            label="Promote to Series"
            type="submit"
            color="primary"
            :loading="isSubmitting"
          />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { RecurrenceRule, EventEntity } from '../../types/event'
import { eventSeriesApi, PromoteToSeriesDto, RecurrenceRuleDto } from '../../api/event-series'
import RecurrenceComponent from './RecurrenceComponent.vue'
import { useRouter } from 'vue-router'
import { useNotification } from '../../composables/useNotification'
import { toBackendRecurrenceRule } from '../../utils/recurrenceUtils'

const props = defineProps<{
  event: EventEntity
  isOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'update:is-open', value: boolean): void;
  (e: 'series-created', seriesSlug: string): void;
}>();

const router = useRouter()
const { success, error } = useNotification()

// Series specific fields
const seriesName = ref(props.event.name)
const seriesDescription = ref(props.event.description || '')

const isRecurring = ref(true)
// If the event already has a timezone, use it, otherwise use the browser's timezone
const timeZone = ref(props.event.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone)

// Default recurrence rule to weekly
const recurrenceRule = ref<Partial<RecurrenceRule>>({
  frequency: 'WEEKLY',
  interval: 1
})

const isSubmitting = ref(false)

const eventStartDate = computed(() => {
  return props.event.startDate
})

const onSubmit = async () => {
  if (!isRecurring.value || !recurrenceRule.value.frequency) {
    error('Please configure a recurrence pattern')
    return
  }

  try {
    isSubmitting.value = true

    // Map the frontend recurrence rule to the backend DTO format
    const mappedRule = toBackendRecurrenceRule(recurrenceRule.value)

    // Set up the request data
    const seriesData: PromoteToSeriesDto = {
      name: seriesName.value,
      description: seriesDescription.value,
      recurrenceRule: mappedRule,
      timeZone: timeZone.value
    }

    // Call the API
    const response = await eventSeriesApi.promoteToSeries(props.event.slug, seriesData)

    // Show success message
    success(`Event successfully promoted to series "${seriesName.value}"`)

    // Close the dialog
    emit('update:is-open', false)

    // Notify parent of the newly created series
    emit('series-created', response.data.slug)

    // Navigate to the series page
    router.push(`/event-series/${response.data.slug}`)
  } catch (err) {
    console.error('Failed to promote event to series:', err)
    error('Failed to promote event to series. Please try again.')
  } finally {
    isSubmitting.value = false
  }
}
</script>
