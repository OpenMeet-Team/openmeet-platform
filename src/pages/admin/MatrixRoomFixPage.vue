<template>
  <q-page padding>
    <div class="container q-pa-md">
      <h1 class="text-h4 text-primary q-mb-md">Matrix Room Permission Fix</h1>

      <div class="q-mb-lg">
        <p class="text-subtitle1">
          This tool helps identify and fix Matrix rooms where the bot has insufficient permissions to manage users.
        </p>
      </div>

      <div class="row q-col-gutter-md">
        <!-- Check for Issues Section -->
        <div class="col-12">
          <q-card>
            <q-card-section>
              <div class="text-h6 text-primary q-mb-md">Room Permission Analysis</div>

              <div class="q-mb-md">
                <q-btn
                  color="primary"
                  label="Check for Permission Issues"
                  icon="sym_r_search"
                  :loading="checkingIssues"
                  @click="checkForIssues"
                />
              </div>

              <!-- Results Summary -->
              <div v-if="permissionResults" class="q-mb-md">
                <q-card flat bordered>
                  <q-card-section>
                    <div class="text-h6 q-mb-sm">Analysis Results</div>
                    <div class="row q-col-gutter-sm">
                      <div class="col-12 col-md-4">
                        <q-chip color="info" text-color="white">
                          Total Rooms: {{ permissionResults.summary.totalRooms }}
                        </q-chip>
                      </div>
                      <div class="col-12 col-md-4">
                        <q-chip
                          :color="permissionResults.summary.roomsWithIssues > 0 ? 'warning' : 'positive'"
                          text-color="white"
                        >
                          Issues Found: {{ permissionResults.summary.roomsWithIssues }}
                        </q-chip>
                      </div>
                      <div class="col-12 col-md-4">
                        <q-chip color="positive" text-color="white">
                          Fixable: {{ permissionResults.summary.fixableRooms }}
                        </q-chip>
                      </div>
                    </div>
                  </q-card-section>
                </q-card>
              </div>
            </q-card-section>
          </q-card>
        </div>

        <!-- Issues List -->
        <div v-if="permissionResults && permissionResults.roomsWithIssues.length > 0" class="col-12">
          <q-card>
            <q-card-section>
              <div class="text-h6 text-primary q-mb-md">Rooms with Permission Issues</div>

              <div class="q-mb-md">
                <q-btn
                  color="positive"
                  label="Fix All Issues (with Admin API)"
                  icon="sym_r_build"
                  :loading="fixingIssues"
                  :disable="!permissionResults || permissionResults.roomsWithIssues.length === 0"
                  @click="fixAllIssues"
                />
                <span v-if="permissionResults && permissionResults.roomsWithIssues.length === 0" class="text-caption text-grey-6 q-ml-sm">
                  No rooms with issues found
                </span>
              </div>

              <q-table
                :rows="permissionResults.roomsWithIssues"
                :columns="columns"
                row-key="roomId"
                :pagination="{ rowsPerPage: 10 }"
                flat
                bordered
              >
                <template #body-cell-roomType="props">
                  <q-td :props="props">
                    <q-chip
                      :color="props.value === 'event' ? 'primary' : 'secondary'"
                      text-color="white"
                      size="sm"
                    >
                      {{ props.value }}
                    </q-chip>
                  </q-td>
                </template>

                <template #body-cell-botCurrentPowerLevel="props">
                  <q-td :props="props">
                    <q-chip
                      :color="props.value >= 100 ? 'positive' : 'warning'"
                      text-color="white"
                      size="sm"
                    >
                      {{ props.value }}
                    </q-chip>
                  </q-td>
                </template>

                <template #body-cell-canBeFixed="props">
                  <q-td :props="props">
                    <q-icon
                      :name="props.value ? 'sym_r_check_circle' : 'sym_r_cancel'"
                      :color="props.value ? 'positive' : 'negative'"
                      size="sm"
                    />
                  </q-td>
                </template>

                <template #body-cell-issues="props">
                  <q-td :props="props">
                    <q-chip
                      v-for="issue in props.value.slice(0, 2)"
                      :key="issue"
                      size="sm"
                      color="warning"
                      text-color="white"
                      class="q-ma-xs"
                    >
                      {{ issue }}
                    </q-chip>
                    <q-chip
                      v-if="props.value.length > 2"
                      size="sm"
                      color="grey"
                      text-color="white"
                      class="q-ma-xs"
                    >
                      +{{ props.value.length - 2 }} more
                    </q-chip>
                  </q-td>
                </template>
              </q-table>
            </q-card-section>
          </q-card>
        </div>

        <!-- No Issues Found -->
        <div v-else-if="permissionResults && permissionResults.roomsWithIssues.length === 0" class="col-12">
          <q-card>
            <q-card-section class="text-center">
              <q-icon name="sym_r_check_circle" size="4em" color="positive" />
              <div class="text-h6 q-mt-md">No Permission Issues Found</div>
              <p class="text-subtitle1 text-grey-6">
                All Matrix rooms have proper bot permissions configured.
              </p>
            </q-card-section>
          </q-card>
        </div>

        <!-- Fix Results -->
        <div v-if="fixResults" class="col-12">
          <q-card>
            <q-card-section>
              <div class="text-h6 text-primary q-mb-md">Fix Results</div>

              <div class="q-mb-md">
                <q-chip color="info" text-color="white">
                  Attempted: {{ fixResults.summary.totalAttempted }}
                </q-chip>
                <q-chip color="positive" text-color="white" class="q-ml-sm">
                  Fixed: {{ fixResults.summary.successfulFixes }}
                </q-chip>
                <q-chip color="negative" text-color="white" class="q-ml-sm">
                  Failed: {{ fixResults.summary.failedFixes }}
                </q-chip>
              </div>

              <!-- Detailed Results -->
              <q-table
                :rows="fixResults.results"
                :columns="fixColumns"
                row-key="roomId"
                :pagination="{ rowsPerPage: 10 }"
                flat
                bordered
              >
                <template #body-cell-fixed="props">
                  <q-td :props="props">
                    <q-icon
                      :name="props.value ? 'sym_r_check_circle' : 'sym_r_cancel'"
                      :color="props.value ? 'positive' : 'negative'"
                      size="sm"
                    />
                  </q-td>
                </template>

                <template #body-cell-newPowerLevel="props">
                  <q-td :props="props">
                    <q-chip
                      :color="props.value >= 100 ? 'positive' : 'warning'"
                      text-color="white"
                      size="sm"
                    >
                      {{ props.value }}
                    </q-chip>
                  </q-td>
                </template>

                <template #body-cell-error="props">
                  <q-td :props="props">
                    <span v-if="props.value" class="text-negative">
                      {{ props.value }}
                    </span>
                    <span v-else class="text-positive">
                      Success
                    </span>
                  </q-td>
                </template>
              </q-table>
            </q-card-section>
          </q-card>
        </div>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useQuasar } from 'quasar'
import { chatApi } from '../../api/chat'

const $q = useQuasar()

// State
const checkingIssues = ref(false)
const fixingIssues = ref(false)
const permissionResults = ref<Awaited<ReturnType<typeof chatApi.listRoomsWithPermissionIssues>>['data'] | null>(null)
const fixResults = ref<Awaited<ReturnType<typeof chatApi.fixRoomPermissions>>['data'] | null>(null)

// // Computed
// const hasFixableRooms = computed(() => {
//   return permissionResults.value?.roomsWithIssues.some(room => room.canBeFixed) ?? false
// })

// Table columns
const columns = [
  {
    name: 'roomType',
    required: true,
    label: 'Type',
    align: 'left' as const,
    field: (row: unknown) => (row as { roomType: string }).roomType,
    format: (val: string) => val.charAt(0).toUpperCase() + val.slice(1)
  },
  {
    name: 'slug',
    required: true,
    label: 'Room Slug',
    align: 'left' as const,
    field: 'slug',
    sortable: true
  },
  {
    name: 'roomId',
    required: true,
    label: 'Room ID',
    align: 'left' as const,
    field: 'roomId',
    format: (val: string) => val.substring(0, 20) + '...'
  },
  {
    name: 'botCurrentPowerLevel',
    required: true,
    label: 'Current Power Level',
    align: 'center' as const,
    field: 'botCurrentPowerLevel',
    sortable: true
  },
  {
    name: 'canBeFixed',
    required: true,
    label: 'Fixable',
    align: 'center' as const,
    field: 'canBeFixed'
  },
  {
    name: 'issues',
    required: true,
    label: 'Issues',
    align: 'left' as const,
    field: 'issues'
  }
]

const fixColumns = [
  {
    name: 'roomId',
    required: true,
    label: 'Room ID',
    align: 'left' as const,
    field: 'roomId',
    format: (val: string) => val.substring(0, 20) + '...'
  },
  {
    name: 'fixed',
    required: true,
    label: 'Fixed',
    align: 'center' as const,
    field: 'fixed'
  },
  {
    name: 'newPowerLevel',
    required: true,
    label: 'New Power Level',
    align: 'center' as const,
    field: 'newPowerLevel'
  },
  {
    name: 'error',
    required: true,
    label: 'Result',
    align: 'left' as const,
    field: 'error'
  }
]

// Methods
const checkForIssues = async () => {
  checkingIssues.value = true
  fixResults.value = null // Clear previous fix results

  try {
    const response = await chatApi.listRoomsWithPermissionIssues()
    permissionResults.value = response.data

    if (response.data.success) {
      $q.notify({
        type: 'positive',
        message: response.data.message || 'Successfully checked for permission issues'
      })
    } else {
      $q.notify({
        type: 'negative',
        message: response.data.message || 'Failed to check for permission issues'
      })
    }
  } catch (error: unknown) {
    console.error('Error checking for permission issues:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const apiError = error as { response?: { data?: { message?: string } } }
    $q.notify({
      type: 'negative',
      message: 'Failed to check for permission issues: ' + (apiError.response?.data?.message || errorMessage)
    })
  } finally {
    checkingIssues.value = false
  }
}

const fixAllIssues = async () => {
  if (!permissionResults.value || permissionResults.value.roomsWithIssues.length === 0) {
    return
  }

  fixingIssues.value = true

  try {
    // Try to fix ALL rooms with issues, not just "fixable" ones
    // The backend will now use admin API as fallback for unfixable rooms
    const allRoomIds = permissionResults.value.roomsWithIssues
      .map(room => room.roomId)

    const response = await chatApi.fixRoomPermissions(allRoomIds)
    fixResults.value = response.data

    if (response.data.success) {
      $q.notify({
        type: 'positive',
        message: response.data.message || `Fixed ${response.data.summary.successfulFixes} rooms successfully`
      })

      // Refresh the issues list after fixing
      await checkForIssues()
    } else {
      $q.notify({
        type: 'negative',
        message: response.data.message || 'Failed to fix room permissions'
      })
    }
  } catch (error: unknown) {
    console.error('Error fixing room permissions:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const apiError = error as { response?: { data?: { message?: string } } }
    $q.notify({
      type: 'negative',
      message: 'Failed to fix room permissions: ' + (apiError.response?.data?.message || errorMessage)
    })
  } finally {
    fixingIssues.value = false
  }
}

// No need for admin check here - router guard handles it

defineOptions({
  name: 'MatrixRoomFixPage'
})
</script>

<style scoped lang="scss">
.container {
  max-width: 1200px;
  margin: 0 auto;
}

.q-table {
  .q-td {
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
