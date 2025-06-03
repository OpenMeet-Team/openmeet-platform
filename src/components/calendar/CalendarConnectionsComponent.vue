<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useQuasar } from 'quasar'
import {
  getCalendarSources,
  deleteCalendarSource,
  syncCalendarSource,
  testCalendarConnection,
  getAuthorizationUrl,
  type CalendarSource
} from '../../api/calendar'
import { downloadUserCalendar } from '../../utils/calendarUtils'

const $q = useQuasar()
const loading = ref(false)
const syncing = ref<Record<string, boolean>>({})
const testing = ref<Record<string, boolean>>({})
const downloading = ref(false)
const calendarSources = ref<CalendarSource[]>([])

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

const sortedCalendarSources = computed(() => {
  return [...calendarSources.value].sort((a, b) => {
    if (a.isActive !== b.isActive) {
      return b.isActive ? 1 : -1
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
})

onMounted(async () => {
  await loadCalendarSources()
})

const loadCalendarSources = async () => {
  try {
    loading.value = true
    const response = await getCalendarSources()
    calendarSources.value = response.data
  } catch (error) {
    console.error('Failed to load calendar sources:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to load calendar connections'
    })
  } finally {
    loading.value = false
  }
}

const connectCalendar = async (type: 'google' | 'apple' | 'outlook') => {
  try {
    const response = await getAuthorizationUrl(type)
    window.location.href = response.data.authorizationUrl
  } catch (error) {
    console.error('Failed to get authorization URL:', error)
    $q.notify({
      type: 'negative',
      message: `Failed to connect ${calendarTypeLabels[type]}`
    })
  }
}

const syncCalendar = async (source: CalendarSource) => {
  try {
    syncing.value[source.ulid] = true
    const response = await syncCalendarSource(source.ulid)

    if (response.data.success) {
      $q.notify({
        type: 'positive',
        message: `Synced ${response.data.eventsCount} events from ${source.name}`
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

const testConnection = async (source: CalendarSource) => {
  try {
    testing.value[source.ulid] = true
    const response = await testCalendarConnection(source.ulid)

    $q.notify({
      type: response.data.success ? 'positive' : 'negative',
      message: response.data.message
    })
  } catch (error) {
    console.error('Failed to test connection:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to test connection'
    })
  } finally {
    testing.value[source.ulid] = false
  }
}

const disconnectCalendar = async (source: CalendarSource) => {
  $q.dialog({
    title: 'Disconnect Calendar',
    message: `Are you sure you want to disconnect "${source.name}"? This will remove all synced events and cannot be undone.`,
    cancel: true,
    persistent: true,
    color: 'negative'
  }).onOk(async () => {
    try {
      await deleteCalendarSource(source.ulid)
      $q.notify({
        type: 'positive',
        message: `Disconnected ${source.name}`
      })
      await loadCalendarSources()
    } catch (error) {
      console.error('Failed to disconnect calendar:', error)
      $q.notify({
        type: 'negative',
        message: 'Failed to disconnect calendar'
      })
    }
  })
}

const formatLastSync = (date?: string) => {
  if (!date) return 'Never synced'
  return new Date(date).toLocaleString()
}

const getSyncStatusColor = (source: CalendarSource) => {
  if (!source.isActive) return 'grey'
  if (!source.lastSyncedAt) return 'orange'

  const lastSync = new Date(source.lastSyncedAt)
  const now = new Date()
  const hoursSinceSync = (now.getTime() - lastSync.getTime()) / (1000 * 60 * 60)

  if (hoursSinceSync > 24) return 'red'
  if (hoursSinceSync > 12) return 'orange'
  return 'green'
}

const downloadPersonalCalendar = async () => {
  try {
    downloading.value = true
    await downloadUserCalendar()
    $q.notify({
      type: 'positive',
      message: 'Calendar download started'
    })
  } catch (error) {
    console.error('Failed to download calendar:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to download calendar'
    })
  } finally {
    downloading.value = false
  }
}
</script>

<template>
  <div class="calendar-connections">
    <div class="row justify-between items-center q-mb-md">
      <div class="text-h6">Calendar Connections</div>
      <q-btn-dropdown
        color="primary"
        label="Connect Calendar"
        icon="sym_r_add"
        :loading="loading"
      >
        <q-list>
          <q-item clickable v-close-popup @click="connectCalendar('google')">
            <q-item-section avatar>
              <q-icon :name="calendarTypeIcons.google" />
            </q-item-section>
            <q-item-section>
              <q-item-label>Google Calendar</q-item-label>
            </q-item-section>
          </q-item>

          <q-item clickable v-close-popup @click="connectCalendar('outlook')">
            <q-item-section avatar>
              <q-icon :name="calendarTypeIcons.outlook" />
            </q-item-section>
            <q-item-section>
              <q-item-label>Microsoft Outlook</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </q-btn-dropdown>
    </div>

    <div v-if="loading" class="text-center q-py-lg">
      <q-spinner size="2em" />
      <div class="q-mt-sm text-grey-6">Loading calendar connections...</div>
    </div>

    <div v-else-if="calendarSources.length === 0" class="text-center q-py-xl">
      <q-icon name="sym_r_calendar_month" size="4em" color="grey-4" />
      <div class="text-h6 text-grey-6 q-mt-md q-mb-sm">No Calendar Connections</div>
      <div class="text-body2 text-grey-5 q-mb-lg">
        Connect your external calendars to see your availability when scheduling events.
      </div>
    </div>

    <q-list v-else separator>
      <q-item
        v-for="source in sortedCalendarSources"
        :key="source.ulid"
        class="q-py-md"
      >
        <q-item-section avatar>
          <q-avatar :color="source.isActive ? 'primary' : 'grey'" text-color="white">
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
            <q-chip
              :color="getSyncStatusColor(source)"
              text-color="white"
              size="sm"
              dense
            >
              {{ source.isActive ? 'Active' : 'Inactive' }}
            </q-chip>
            <span class="q-ml-sm text-grey-6">
              Last sync: {{ formatLastSync(source.lastSyncedAt) }}
            </span>
          </q-item-label>
        </q-item-section>

        <q-item-section side>
          <div class="row q-gutter-xs">
            <q-btn
              round
              flat
              size="sm"
              icon="sym_r_sync"
              color="primary"
              :loading="syncing[source.ulid]"
              @click="syncCalendar(source)"
              :disable="!source.isActive"
            >
              <q-tooltip>Sync Now</q-tooltip>
            </q-btn>

            <q-btn
              round
              flat
              size="sm"
              icon="sym_r_wifi"
              color="positive"
              :loading="testing[source.ulid]"
              @click="testConnection(source)"
              :disable="!source.isActive"
            >
              <q-tooltip>Test Connection</q-tooltip>
            </q-btn>

            <q-btn
              round
              flat
              size="sm"
              icon="sym_r_delete"
              color="negative"
              @click="disconnectCalendar(source)"
            >
              <q-tooltip>Disconnect</q-tooltip>
            </q-btn>
          </div>
        </q-item-section>
      </q-item>
    </q-list>

    <div v-if="calendarSources.length > 0" class="q-mt-md text-caption text-grey-6">
      <q-icon name="sym_r_info" size="sm" class="q-mr-xs" />
      Calendar sources sync automatically every hour. Use "Sync Now" for immediate updates.
    </div>

    <!-- Personal Calendar Download Section -->
    <q-separator class="q-my-lg" />

    <div class="personal-calendar-section">
      <div class="text-h6 q-mb-md">
        <q-icon name="sym_r_download" class="q-mr-sm" />
        Your OpenMeet Calendar
      </div>

      <div class="text-body2 text-grey-7 q-mb-md">
        Download all your OpenMeet events (organized and attended) as an iCalendar (.ics) file that you can import into any calendar application.
      </div>

      <q-btn
        color="primary"
        icon="sym_r_download"
        label="Download My Calendar"
        :loading="downloading"
        @click="downloadPersonalCalendar"
        no-caps
        data-cy="download-personal-calendar"
      />

      <div class="q-mt-sm text-caption text-grey-6">
        <q-icon name="sym_r_info" size="sm" class="q-mr-xs" />
        Includes all events you've created or are attending. Compatible with Google Calendar, Apple Calendar, Outlook, and other calendar apps.
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.calendar-connections {
  .q-item {
    border-radius: 8px;
    margin-bottom: 4px;

    &:hover {
      background-color: rgba(0, 0, 0, 0.02);
    }
  }

  .q-chip {
    font-size: 0.7rem;
  }
}
</style>
