<script setup lang="ts">
import { ref } from 'vue'
import { useMeta } from 'quasar'
import DashboardTitle from '../../components/dashboard/DashboardTitle.vue'
import CalendarConnectionsComponent from '../../components/calendar/CalendarConnectionsComponent.vue'
import AvailabilityCheckerComponent from '../../components/calendar/AvailabilityCheckerComponent.vue'
import CalendarSyncStatusComponent from '../../components/calendar/CalendarSyncStatusComponent.vue'
import type { AvailabilityResponse, ConflictEvent } from '../../api/calendar'

useMeta({
  title: 'Calendar Integration Demo'
})

const availabilityResult = ref<AvailabilityResponse | null>(null)
const conflictEvents = ref<ConflictEvent[]>([])

const onAvailabilityChecked = (result: AvailabilityResponse) => {
  availabilityResult.value = result
}

const onConflictDetected = (conflicts: ConflictEvent[]) => {
  conflictEvents.value = conflicts
}

// Example datetime for testing
const now = new Date()
const startTime = new Date(now.getTime() + 60 * 60 * 1000) // 1 hour from now
const endTime = new Date(now.getTime() + 2 * 60 * 60 * 1000) // 2 hours from now

const formatDateTime = (date: Date) => {
  return date.toISOString().slice(0, 16)
}
</script>

<template>
  <q-page padding style="max-width: 1200px" class="q-mx-auto q-pb-xl">
    <DashboardTitle defaultBack label="Calendar Integration Demo"/>

    <div class="row q-gutter-lg">
      <!-- Left Column -->
      <div class="col-12 col-md-6">
        <!-- Calendar Connections -->
        <q-card class="q-mb-lg">
          <q-card-section>
            <div class="text-h6 q-mb-md">
              <q-icon name="sym_r_settings" class="q-mr-sm" />
              Connection Management
            </div>
            <CalendarConnectionsComponent />
          </q-card-section>
        </q-card>

        <!-- Sync Status -->
        <q-card class="q-mb-lg">
          <q-card-section>
            <div class="text-h6 q-mb-md">
              <q-icon name="sym_r_sync" class="q-mr-sm" />
              Sync Status
            </div>
            <CalendarSyncStatusComponent />
          </q-card-section>
        </q-card>

        <!-- Compact Sync Status Example -->
        <q-card>
          <q-card-section>
            <div class="text-h6 q-mb-md">
              <q-icon name="sym_r_dashboard" class="q-mr-sm" />
              Compact Status (for dashboard)
            </div>
            <CalendarSyncStatusComponent compact :show-actions="false" />
          </q-card-section>
        </q-card>
      </div>

      <!-- Right Column -->
      <div class="col-12 col-md-6">
        <!-- Availability Checker -->
        <q-card class="q-mb-lg">
          <q-card-section>
            <div class="text-h6 q-mb-md">
              <q-icon name="sym_r_schedule" class="q-mr-sm" />
              Availability Checker
            </div>
            <AvailabilityCheckerComponent
              :start-time="formatDateTime(startTime)"
              :end-time="formatDateTime(endTime)"
              :auto-check="false"
              @availability-checked="onAvailabilityChecked"
              @conflict-detected="onConflictDetected"
            />
          </q-card-section>
        </q-card>

        <!-- Auto-checking Example -->
        <q-card class="q-mb-lg">
          <q-card-section>
            <div class="text-h6 q-mb-md">
              <q-icon name="sym_r_auto_mode" class="q-mr-sm" />
              Auto-checking Example (for event creation)
            </div>
            <AvailabilityCheckerComponent
              :auto-check="true"
            />
          </q-card-section>
        </q-card>

        <!-- Integration Examples -->
        <q-card>
          <q-card-section>
            <div class="text-h6 q-mb-md">
              <q-icon name="sym_r_integration_instructions" class="q-mr-sm" />
              Integration Examples
            </div>

            <q-list>
              <q-item>
                <q-item-section avatar>
                  <q-icon name="sym_r_event" color="primary" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>Event Creation</q-item-label>
                  <q-item-label caption>
                    Use AvailabilityCheckerComponent with auto-check enabled
                  </q-item-label>
                </q-item-section>
              </q-item>

              <q-item>
                <q-item-section avatar>
                  <q-icon name="sym_r_dashboard" color="positive" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>Dashboard Widget</q-item-label>
                  <q-item-label caption>
                    Use compact CalendarSyncStatusComponent
                  </q-item-label>
                </q-item-section>
              </q-item>

              <q-item>
                <q-item-section avatar>
                  <q-icon name="sym_r_settings" color="orange" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>Profile Settings</q-item-label>
                  <q-item-label caption>
                    Use full CalendarConnectionsComponent (already integrated)
                  </q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <!-- API Test Results -->
    <div v-if="availabilityResult" class="q-mt-lg">
      <q-card>
        <q-card-section>
          <div class="text-h6 q-mb-md">
            <q-icon name="sym_r_api" class="q-mr-sm" />
            Last API Response
          </div>

          <q-banner
            :class="availabilityResult.available ? 'bg-positive text-white' : 'bg-warning text-dark'"
            rounded
          >
            <template v-slot:avatar>
              <q-icon :name="availabilityResult.available ? 'sym_r_check_circle' : 'sym_r_warning'" />
            </template>
            {{ availabilityResult.message }}
          </q-banner>

          <div class="q-mt-md">
            <div class="text-weight-bold">Raw Response:</div>
            <pre class="bg-grey-2 q-pa-sm rounded text-caption overflow-auto">{{ JSON.stringify(availabilityResult, null, 2) }}</pre>
          </div>
        </q-card-section>
      </q-card>
    </div>
  </q-page>
</template>

<style scoped lang="scss">
pre {
  max-height: 300px;
  font-family: 'Courier New', monospace;
  font-size: 0.8rem;
  line-height: 1.2;
}

.q-card {
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  }
}
</style>
