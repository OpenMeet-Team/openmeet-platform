<template>
  <q-page padding>
    <div class="container q-pa-md">
      <div class="q-mb-md">
        <router-link to="/admin" class="q-pr-sm">
          <q-icon name="sym_r_arrow_back" />
          Back to Admin Dashboard
        </router-link>
      </div>

      <h1 class="text-h4 text-primary q-mb-md">Matrix Attendee Sync</h1>

      <div class="q-mb-lg bg-blue-1 q-pa-md rounded-borders">
        <p class="text-subtitle1 q-mb-none">
          <q-icon name="sym_r_info" color="info" class="q-mr-sm" />
          This tool syncs all confirmed event attendees across all tenants to their respective Matrix chat rooms.
          Use this for backfilling Matrix room membership or after system maintenance.
        </p>
      </div>

      <q-card class="q-mb-lg">
        <q-card-section>
          <div class="text-h6">Matrix Sync Control</div>
        </q-card-section>

        <q-card-section>
          <div class="q-mb-md">
            <q-input
              v-model.number="eventsPerTenant"
              type="number"
              label="Max Events Per Tenant (0 = all)"
              min="0"
              max="100"
              outlined
              dense
              class="q-mb-md"
              style="max-width: 300px"
            >
              <template v-slot:prepend>
                <q-icon name="sym_r_event" />
              </template>
              <template v-slot:hint>
                Limit sync to test with fewer events first
              </template>
            </q-input>
            
            <q-btn
              color="primary"
              label="Start Matrix Sync"
              icon="sym_r_sync"
              :loading="syncLoading"
              :disable="syncLoading"
              @click="startSync"
              size="lg"
            />
          </div>
          
          <div v-if="syncLoading" class="text-body2 text-grey-7">
            Sync in progress... This may take several minutes depending on the number of tenants and events.
          </div>
        </q-card-section>
      </q-card>

      <!-- Sync Results -->
      <q-card v-if="syncResults" class="q-mb-lg">
        <q-card-section>
          <div class="text-h6 row items-center">
            <q-icon 
              :name="syncResults.success ? 'sym_r_check_circle' : 'sym_r_error'" 
              :color="syncResults.success ? 'positive' : 'negative'" 
              class="q-mr-sm" 
            />
            Sync Results
          </div>
        </q-card-section>

        <q-card-section>
          <!-- Overall Statistics -->
          <div class="row q-col-gutter-md q-mb-md">
            <div class="col-6 col-md-3">
              <q-card flat bordered>
                <q-card-section class="text-center">
                  <div class="text-h4 text-primary">{{ syncResults.results.totalTenants }}</div>
                  <div class="text-body2 text-grey-7">Tenants</div>
                </q-card-section>
              </q-card>
            </div>
            <div class="col-6 col-md-3">
              <q-card flat bordered>
                <q-card-section class="text-center">
                  <div class="text-h4 text-primary">{{ syncResults.results.totalEvents }}</div>
                  <div class="text-body2 text-grey-7">Events</div>
                </q-card-section>
              </q-card>
            </div>
            <div class="col-6 col-md-3">
              <q-card flat bordered>
                <q-card-section class="text-center">
                  <div class="text-h4 text-positive">{{ syncResults.results.totalUsersAdded }}</div>
                  <div class="text-body2 text-grey-7">Users Added</div>
                </q-card-section>
              </q-card>
            </div>
            <div class="col-6 col-md-3">
              <q-card flat bordered>
                <q-card-section class="text-center">
                  <div class="text-h4 text-negative">{{ syncResults.results.totalErrors }}</div>
                  <div class="text-body2 text-grey-7">Errors</div>
                </q-card-section>
              </q-card>
            </div>
          </div>

          <!-- Timing Information -->
          <div class="text-body2 text-grey-7 q-mb-md">
            <strong>Duration:</strong> {{ formatDuration(syncResults.results.duration) }} |
            <strong>Started:</strong> {{ formatTimestamp(syncResults.results.startTime) }} |
            <strong>Completed:</strong> {{ formatTimestamp(syncResults.results.endTime) }}
          </div>
        </q-card-section>
      </q-card>

      <!-- Tenant Details -->
      <q-card v-if="syncResults && syncResults.results.tenants.length > 0">
        <q-card-section>
          <div class="text-h6">Tenant Details</div>
        </q-card-section>

        <q-card-section>
          <q-expansion-item
            v-for="tenant in syncResults.results.tenants"
            :key="tenant.tenantId"
            :label="tenant.tenantName || tenant.tenantId"
            :caption="`${tenant.eventsProcessed} events, ${tenant.totalUsersAdded} users added, ${tenant.totalErrors} errors`"
            class="q-mb-sm"
          >
            <q-card flat bordered class="q-ma-sm">
              <q-card-section>
                <div class="row q-col-gutter-sm q-mb-md">
                  <div class="col-6">
                    <strong>Tenant ID:</strong> {{ tenant.tenantId }}
                  </div>
                  <div class="col-6">
                    <strong>Status:</strong> 
                    <q-chip 
                      :color="tenant.success ? 'positive' : 'negative'" 
                      text-color="white" 
                      size="sm"
                    >
                      {{ tenant.success ? 'Success' : 'Failed' }}
                    </q-chip>
                  </div>
                </div>

                <!-- Tenant-level errors -->
                <div v-if="tenant.errors.length > 0" class="q-mb-md">
                  <div class="text-subtitle2 text-negative">Tenant Errors:</div>
                  <q-list dense>
                    <q-item v-for="(error, index) in tenant.errors" :key="index">
                      <q-item-section>
                        <q-item-label class="text-negative">{{ error }}</q-item-label>
                      </q-item-section>
                    </q-item>
                  </q-list>
                </div>

                <!-- Event Details -->
                <div v-if="tenant.events.length > 0">
                  <div class="text-subtitle2 q-mb-sm">Events:</div>
                  <q-table
                    :rows="tenant.events"
                    :columns="eventColumns"
                    row-key="eventSlug"
                    flat
                    dense
                    :pagination="{ rowsPerPage: 10 }"
                  >
                    <template v-slot:body-cell-success="props">
                      <q-td :props="props">
                        <q-chip 
                          :color="props.value ? 'positive' : 'negative'" 
                          text-color="white" 
                          size="sm"
                        >
                          {{ props.value ? 'Success' : 'Failed' }}
                        </q-chip>
                      </q-td>
                    </template>
                    <template v-slot:body-cell-errors="props">
                      <q-td :props="props">
                        <div v-if="props.value.length > 0">
                          <q-btn 
                            size="sm" 
                            color="negative" 
                            :label="`${props.value.length} error(s)`"
                            @click="showEventErrors(props.value)"
                          />
                        </div>
                        <div v-else class="text-grey-7">None</div>
                      </q-td>
                    </template>
                  </q-table>
                </div>
              </q-card-section>
            </q-card>
          </q-expansion-item>
        </q-card-section>
      </q-card>

      <!-- Error Details Dialog -->
      <q-dialog v-model="errorDialog">
        <q-card style="min-width: 350px; max-width: 600px;">
          <q-card-section class="bg-negative text-white">
            <div class="text-h6">Event Errors</div>
          </q-card-section>

          <q-card-section class="q-pt-md">
            <q-list>
              <q-item v-for="(error, index) in selectedErrors" :key="index">
                <q-item-section>
                  <q-item-label class="text-negative">{{ error }}</q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </q-card-section>

          <q-card-actions align="right">
            <q-btn flat label="Close" color="primary" v-close-popup />
          </q-card-actions>
        </q-card>
      </q-dialog>

      <!-- General Error Dialog -->
      <q-dialog v-model="generalErrorDialog">
        <q-card style="min-width: 350px">
          <q-card-section class="bg-negative text-white">
            <div class="text-h6">Error</div>
          </q-card-section>

          <q-card-section class="q-pt-md">
            {{ generalErrorMessage }}
          </q-card-section>

          <q-card-actions align="right">
            <q-btn flat label="Close" color="primary" v-close-popup />
          </q-card-actions>
        </q-card>
      </q-dialog>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth-store'
import { UserRole } from '../../types'
import { matrixApi } from '../../api/matrix'

const router = useRouter()
const authStore = useAuthStore()

const syncLoading = ref(false)
const syncResults = ref<any>(null)
const errorDialog = ref(false)
const selectedErrors = ref<string[]>([])
const generalErrorDialog = ref(false)
const generalErrorMessage = ref('')
const eventsPerTenant = ref(2) // Default to 2 events per tenant for testing

const eventColumns = [
  {
    name: 'eventSlug',
    label: 'Event Slug',
    field: 'eventSlug',
    align: 'left'
  },
  {
    name: 'eventName',
    label: 'Event Name',
    field: 'eventName',
    align: 'left'
  },
  {
    name: 'attendeesFound',
    label: 'Attendees',
    field: 'attendeesFound',
    align: 'center'
  },
  {
    name: 'usersAdded',
    label: 'Added',
    field: 'usersAdded',
    align: 'center'
  },
  {
    name: 'success',
    label: 'Status',
    field: 'success',
    align: 'center'
  },
  {
    name: 'errors',
    label: 'Errors',
    field: 'errors',
    align: 'center'
  }
]

// Check if user is an admin
onMounted(() => {
  if (!authStore.hasRole(UserRole.Admin)) {
    // Redirect non-admin users to home page
    router.push('/')
  }
})

async function startSync() {
  try {
    syncLoading.value = true
    syncResults.value = null
    
    console.log('🚀 Starting Matrix attendee sync...')
    
    const maxEvents = eventsPerTenant.value > 0 ? eventsPerTenant.value : undefined
    const response = await matrixApi.adminSyncAllAttendees(maxEvents)
    syncResults.value = response.data
    
    console.log('✅ Matrix sync completed:', response.data)
  } catch (error) {
    console.error('❌ Matrix sync failed:', error)
    generalErrorMessage.value = error instanceof Error ? error.message : 'Failed to sync Matrix attendees'
    generalErrorDialog.value = true
  } finally {
    syncLoading.value = false
  }
}

function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`
  }
  return `${remainingSeconds}s`
}

function formatTimestamp(timestamp: string | Date): string {
  const date = new Date(timestamp)
  return date.toLocaleString()
}

function showEventErrors(errors: string[]) {
  selectedErrors.value = errors
  errorDialog.value = true
}

defineOptions({
  name: 'MatrixSyncAdminPage'
})
</script>

<style scoped lang="scss">
.container {
  max-width: 1200px;
  margin: 0 auto;
}

a {
  text-decoration: none;
  color: $primary;
  display: inline-flex;
  align-items: center;
}
</style>