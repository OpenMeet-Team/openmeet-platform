<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useQuasar } from 'quasar'
import {
  getCalendarSources,
  syncCalendarSource,
  type CalendarSource
} from '../../api/calendar'

interface Props {
  compact?: boolean
  showActions?: boolean
  autoRefresh?: boolean
  refreshInterval?: number
}

const props = withDefaults(defineProps<Props>(), {
  compact: false,
  showActions: true,
  autoRefresh: true,
  refreshInterval: 30000 // 30 seconds
})

const $q = useQuasar()
const loading = ref(false)
const syncing = ref<Record<string, boolean>>({})
const calendarSources = ref<CalendarSource[]>([])
const lastRefresh = ref<Date>(new Date())
let refreshTimer: ReturnType<typeof setInterval> | null = null

const calendarTypeIcons = {
  google: 'fab fa-google',
  apple: 'fab fa-apple',
  outlook: 'fab fa-microsoft',
  ical: 'sym_r_calendar_month'
}

const calendarTypeLabels = {
  google: 'Google Calendar',
  apple: 'Apple Calendar',
  outlook: 'Microsoft Outlook',
  ical: 'iCal URL'
}

const activeSources = computed(() => {
  return calendarSources.value.filter(source => source.isActive)
})

const syncStatistics = computed(() => {
  const total = activeSources.value.length
  const synced = activeSources.value.filter(source => source.lastSyncedAt).length
  const recentlySynced = activeSources.value.filter(source => {
    if (!source.lastSyncedAt) return false
    const lastSync = new Date(source.lastSyncedAt)
    const hoursSinceSync = (Date.now() - lastSync.getTime()) / (1000 * 60 * 60)
    return hoursSinceSync <= 1
  }).length

  return { total, synced, recentlySynced }
})

const getSyncStatus = (source: CalendarSource) => {
  if (!source.lastSyncedAt) {
    return { status: 'never', color: 'grey', label: 'Never synced', icon: 'sym_r_help' }
  }

  const lastSync = new Date(source.lastSyncedAt)
  const hoursSinceSync = (Date.now() - lastSync.getTime()) / (1000 * 60 * 60)

  if (hoursSinceSync <= 1) {
    return { status: 'recent', color: 'positive', label: 'Recently synced', icon: 'sym_r_check_circle' }
  } else if (hoursSinceSync <= 12) {
    return { status: 'good', color: 'positive', label: 'Up to date', icon: 'sym_r_check' }
  } else if (hoursSinceSync <= 24) {
    return { status: 'stale', color: 'warning', label: 'Needs sync', icon: 'sym_r_schedule' }
  } else {
    return { status: 'outdated', color: 'negative', label: 'Outdated', icon: 'sym_r_error' }
  }
}

const formatTimeAgo = (date?: string) => {
  if (!date) return 'Never'

  const now = Date.now()
  const syncTime = new Date(date).getTime()
  const diffMs = now - syncTime

  const minutes = Math.floor(diffMs / (1000 * 60))
  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

onMounted(() => {
  loadCalendarSources()

  if (props.autoRefresh) {
    refreshTimer = setInterval(() => {
      loadCalendarSources()
    }, props.refreshInterval)
  }
})

onUnmounted(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
  }
})

const loadCalendarSources = async () => {
  try {
    loading.value = true
    const response = await getCalendarSources()
    calendarSources.value = response.data
    lastRefresh.value = new Date()
  } catch (error) {
    console.error('Failed to load calendar sources:', error)
  } finally {
    loading.value = false
  }
}

const syncCalendar = async (source: CalendarSource) => {
  try {
    syncing.value[source.ulid] = true
    const response = await syncCalendarSource(source.ulid)

    if (response.data.success) {
      $q.notify({
        type: 'positive',
        message: `Synced ${response.data.eventsCount} events from ${source.name}`,
        timeout: 2000
      })
      await loadCalendarSources()
    } else {
      $q.notify({
        type: 'negative',
        message: response.data.error || 'Sync failed'
      })
    }
  } catch (error) {
    console.error('Failed to sync calendar:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to sync calendar'
    })
  } finally {
    syncing.value[source.ulid] = false
  }
}

const syncAllCalendars = async () => {
  const activeCalendars = activeSources.value

  for (const source of activeCalendars) {
    if (!syncing.value[source.ulid]) {
      await syncCalendar(source)
    }
  }
}
</script>

<template>
  <div class="calendar-sync-status">
    <!-- Compact View -->
    <div v-if="compact" class="compact-view">
      <div class="row items-center q-gutter-sm">
        <q-icon
          :name="syncStatistics.total === 0 ? 'sym_r_calendar_month' : 'sym_r_sync'"
          :color="syncStatistics.total === 0 ? 'grey' :
                  syncStatistics.recentlySynced === syncStatistics.total ? 'positive' :
                  syncStatistics.synced > 0 ? 'warning' : 'negative'"
          size="sm"
        />

        <span class="text-body2">
          <template v-if="syncStatistics.total === 0">
            No calendars connected
          </template>
          <template v-else>
            {{ syncStatistics.recentlySynced }}/{{ syncStatistics.total }} synced
          </template>
        </span>

        <q-spinner v-if="loading" size="sm" />

        <q-btn
          v-if="showActions && syncStatistics.total > 0"
          flat
          round
          dense
          size="sm"
          icon="sym_r_refresh"
          @click="loadCalendarSources"
          :loading="loading"
        >
          <q-tooltip>Refresh status</q-tooltip>
        </q-btn>
      </div>
    </div>

    <!-- Full View -->
    <div v-else class="full-view">
      <div class="row justify-between items-center q-mb-md">
        <div class="text-h6">Calendar Sync Status</div>
        <div class="row q-gutter-sm">
          <q-btn
            flat
            icon="sym_r_refresh"
            @click="loadCalendarSources"
            :loading="loading"
            size="sm"
          >
            <q-tooltip>Refresh</q-tooltip>
          </q-btn>

          <q-btn
            v-if="showActions && activeSources.length > 0"
            color="primary"
            icon="sym_r_sync"
            @click="syncAllCalendars"
            :loading="Object.values(syncing).some(Boolean)"
            size="sm"
          >
            Sync All
          </q-btn>
        </div>
      </div>

      <!-- Summary Cards -->
      <div class="row q-gutter-md q-mb-lg">
        <q-card class="col-auto" flat bordered>
          <q-card-section class="text-center q-py-md">
            <div class="text-h4 text-primary">{{ syncStatistics.total }}</div>
            <div class="text-caption text-grey-6">Connected</div>
          </q-card-section>
        </q-card>

        <q-card class="col-auto" flat bordered>
          <q-card-section class="text-center q-py-md">
            <div class="text-h4 text-positive">{{ syncStatistics.recentlySynced }}</div>
            <div class="text-caption text-grey-6">Recently Synced</div>
          </q-card-section>
        </q-card>

        <q-card class="col-auto" flat bordered>
          <q-card-section class="text-center q-py-md">
            <div class="text-h4 text-grey-6">{{ formatTimeAgo(lastRefresh.toISOString()) }}</div>
            <div class="text-caption text-grey-6">Last Check</div>
          </q-card-section>
        </q-card>
      </div>

      <!-- Calendar List -->
      <div v-if="activeSources.length === 0" class="text-center q-py-xl">
        <q-icon name="sym_r_calendar_month" size="3em" color="grey-4" />
        <div class="text-h6 text-grey-6 q-mt-md">No Active Calendars</div>
        <div class="text-body2 text-grey-5">Connect your external calendars to see sync status.</div>
      </div>

      <q-list v-else separator class="rounded-borders">
        <q-item
          v-for="source in activeSources"
          :key="source.ulid"
          class="q-py-md"
        >
          <q-item-section avatar>
            <q-avatar color="primary" text-color="white">
              <q-icon :name="calendarTypeIcons[source.type]" />
            </q-avatar>
          </q-item-section>

          <q-item-section>
            <q-item-label class="text-weight-medium">
              {{ source.name }}
            </q-item-label>
            <q-item-label caption>
              {{ calendarTypeLabels[source.type] }}
            </q-item-label>
            <q-item-label caption class="q-mt-xs">
              Last sync: {{ formatTimeAgo(source.lastSyncedAt) }}
            </q-item-label>
          </q-item-section>

          <q-item-section side>
            <div class="column items-end q-gutter-xs">
              <q-chip
                :color="getSyncStatus(source).color"
                text-color="white"
                size="sm"
                :icon="getSyncStatus(source).icon"
                dense
              >
                {{ getSyncStatus(source).label }}
              </q-chip>

              <q-btn
                v-if="showActions"
                flat
                size="sm"
                icon="sym_r_sync"
                color="primary"
                :loading="syncing[source.ulid]"
                @click="syncCalendar(source)"
              >
                Sync
              </q-btn>
            </div>
          </q-item-section>
        </q-item>
      </q-list>

      <!-- Auto-refresh indicator -->
      <div v-if="props.autoRefresh" class="text-center q-mt-md">
        <div class="text-caption text-grey-5">
          <q-icon name="sym_r_autorenew" size="xs" class="q-mr-xs" />
          Auto-refreshing every {{ Math.round(props.refreshInterval / 1000) }} seconds
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.calendar-sync-status {
  .compact-view {
    .q-icon {
      transition: color 0.3s ease;
    }
  }

  .full-view {
    .q-card {
      min-width: 120px;
      transition: transform 0.2s ease;

      &:hover {
        transform: translateY(-2px);
      }
    }

    .q-item {
      border-radius: 8px;
      margin-bottom: 4px;

      &:hover {
        background-color: rgba(0, 0, 0, 0.02);
      }
    }
  }
}
</style>
