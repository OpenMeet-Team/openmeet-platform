<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useQuasar } from 'quasar'
import {
  getCalendarSources,
  deleteCalendarSource,
  syncCalendarSource,
  testCalendarConnection,
  getAuthorizationUrl,
  createCalendarSource,
  type CalendarSource,
  type CreateCalendarSourceDto
} from '../../api/calendar'
import { downloadUserCalendar } from '../../utils/calendarUtils'

const $q = useQuasar()
const loading = ref(false)
const syncing = ref<Record<string, boolean>>({})
const testing = ref<Record<string, boolean>>({})
const downloading = ref(false)
const calendarSources = ref<CalendarSource[]>([])

// iCal URL dialog state
const showIcalDialog = ref(false)
const icalForm = ref({
  name: '',
  url: '',
  isPrivate: false
})
const creatingIcal = ref(false)

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

const showIcalUrlDialog = () => {
  icalForm.value = {
    name: '',
    url: '',
    isPrivate: false
  }
  showIcalDialog.value = true
}

const connectAppleCalendar = () => {
  // Apple Calendar uses iCal URL, so show the same dialog but pre-fill name
  icalForm.value = {
    name: 'Apple Calendar',
    url: '',
    isPrivate: false
  }
  showIcalDialog.value = true
}

const createIcalSource = async () => {
  try {
    creatingIcal.value = true

    // Validate form
    if (!icalForm.value.name.trim() || !icalForm.value.url.trim()) {
      $q.notify({
        type: 'negative',
        message: 'Please provide both a name and URL'
      })
      return
    }

    // Validate URL format
    try {
      const validUrl = new URL(icalForm.value.url)
      // Use the URL to prevent the no-new error
      if (!validUrl.protocol.startsWith('http')) {
        throw new Error('Invalid protocol')
      }

      // Check if it's a Google Calendar embed URL (common mistake)
      if (validUrl.hostname === 'calendar.google.com' && validUrl.pathname.includes('/embed')) {
        $q.notify({
          type: 'negative',
          message: 'This is a Google Calendar embed URL. For better privacy, use Google Calendar OAuth instead. Or see help below for iCal URL instructions.'
        })
        return
      }

      // Check if URL looks like an iCal URL (should end with .ics or have ical in path)
      const urlPath = validUrl.pathname.toLowerCase()
      const urlParams = validUrl.search.toLowerCase()
      const isIcalUrl = urlPath.endsWith('.ics') ||
                       urlPath.includes('ical') ||
                       urlParams.includes('ical') ||
                       urlParams.includes('exportType=ical') ||
                       validUrl.hostname.includes('webcal')

      if (!isIcalUrl) {
        $q.notify({
          type: 'warning',
          message: 'This URL may not be an iCal feed. Make sure you\'re using the correct iCal export URL from your calendar provider.',
          timeout: 8000
        })
      }
    } catch {
      $q.notify({
        type: 'negative',
        message: 'Please enter a valid URL'
      })
      return
    }

    const isApple = icalForm.value.name.toLowerCase().includes('apple')
    const createData: CreateCalendarSourceDto = {
      type: isApple ? 'apple' : 'ical',
      name: icalForm.value.name.trim(),
      url: icalForm.value.url.trim(),
      isPrivate: icalForm.value.isPrivate
    }

    const response = await createCalendarSource(createData)

    $q.notify({
      type: 'positive',
      message: `Successfully connected ${response.data.name}`
    })

    showIcalDialog.value = false
    await loadCalendarSources()
  } catch (error: unknown) {
    console.error('Failed to create iCal source:', error)
    const errorMessage = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to connect calendar'
    $q.notify({
      type: 'negative',
      message: errorMessage
    })
  } finally {
    creatingIcal.value = false
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
              <q-item-label caption>OAuth authentication</q-item-label>
            </q-item-section>
          </q-item>

          <q-item clickable v-close-popup @click="connectAppleCalendar">
            <q-item-section avatar>
              <q-icon :name="calendarTypeIcons.apple" />
            </q-item-section>
            <q-item-section>
              <q-item-label>Apple Calendar</q-item-label>
              <q-item-label caption>iCal URL subscription</q-item-label>
            </q-item-section>
          </q-item>

          <q-item clickable v-close-popup @click="connectCalendar('outlook')">
            <q-item-section avatar>
              <q-icon :name="calendarTypeIcons.outlook" />
            </q-item-section>
            <q-item-section>
              <q-item-label>Microsoft Outlook</q-item-label>
              <q-item-label caption>OAuth authentication</q-item-label>
            </q-item-section>
          </q-item>

          <q-separator />

          <q-item clickable v-close-popup @click="showIcalUrlDialog">
            <q-item-section avatar>
              <q-icon :name="calendarTypeIcons.ical" />
            </q-item-section>
            <q-item-section>
              <q-item-label>iCal URL</q-item-label>
              <q-item-label caption>Any calendar with iCal subscription</q-item-label>
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
        Connect your external calendars (Google, Apple, Outlook, or any iCal URL) to see your availability when scheduling events.
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
            <span v-if="source.isPrivate" class="q-ml-sm">
              <q-chip size="xs" color="grey" text-color="white" dense>
                Private
              </q-chip>
            </span>
          </q-item-label>
          <q-item-label v-if="source.url" caption class="text-grey-6 q-mt-xs">
            <q-icon name="sym_r_link" size="xs" class="q-mr-xs" />
            {{ source.url.length > 50 ? source.url.substring(0, 50) + '...' : source.url }}
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

    <!-- iCal URL Dialog -->
    <q-dialog v-model="showIcalDialog" persistent>
      <q-card style="min-width: 500px">
        <q-card-section class="row items-center">
          <q-icon name="sym_r_calendar_month" size="md" color="primary" class="q-mr-sm" />
          <div class="text-h6">Add iCal Calendar</div>
          <q-space />
          <q-btn flat round dense icon="sym_r_close" @click="showIcalDialog = false" />
        </q-card-section>

        <q-card-section>
          <div class="text-body2 text-grey-7 q-mb-md">
            Connect any calendar that provides an iCal subscription URL.
            <strong>Note:</strong> Most iCal URLs require making calendars public. For privacy, consider using OAuth connections (Google/Outlook) or creating separate public calendars for sharing.
          </div>

          <q-form @submit="createIcalSource" class="q-gutter-md">
            <q-input
              v-model="icalForm.name"
              label="Calendar Name"
              hint="A friendly name to identify this calendar"
              outlined
              :rules="[val => !!val.trim() || 'Name is required']"
            />

            <q-input
              v-model="icalForm.url"
              label="iCal URL"
              hint="The .ics subscription URL from your calendar provider (usually ends with .ics)"
              outlined
              type="text"
              :rules="[
                val => !!val.trim() || 'URL is required',
                val => {
                  try {
                    const url = val.trim()
                    return (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('webcal://')) && url.includes('.') || 'Please enter a valid URL (starting with http://, https://, or webcal://)'
                  } catch {
                    return 'Please enter a valid URL'
                  }
                }
              ]"
            >
              <template v-slot:prepend>
                <q-icon name="sym_r_link" />
              </template>
            </q-input>

            <q-toggle
              v-model="icalForm.isPrivate"
              label="Hide event details"
              left-label
            />
            <div v-if="icalForm.isPrivate" class="text-caption text-grey-6 q-mt-xs q-mb-md">
              Only show busy/free times without event titles or descriptions
            </div>

            <div class="q-mt-lg">
              <q-expansion-item
                icon="sym_r_help"
                label="How to find your iCal URL"
                class="text-grey-7"
              >
                <q-card flat class="q-pa-md bg-grey-1">
                  <div class="text-body2">
                    <div class="text-weight-medium q-mb-sm">Apple Calendar (iCloud):</div>
                    <div class="q-mb-md text-grey-8">
                      1. Create a separate calendar for sharing (not your main personal calendar)<br>
                      2. Go to iCloud.com → Calendar<br>
                      3. Click the share icon next to your sharing calendar<br>
                      4. Check "Public Calendar" and copy the URL<br>
                      <strong>⚠️ Warning:</strong> This makes the calendar PUBLIC. Only use for non-sensitive events.
                    </div>

                    <div class="text-weight-medium q-mb-sm">Google Calendar:</div>
                    <div class="q-mb-md text-grey-8">
                      <strong>Recommended:</strong> Use Google Calendar OAuth instead (click "Google Calendar" above)<br><br>
                      <strong>Alternative (iCal URL):</strong><br>
                      1. Create a separate calendar for sharing (not your main personal calendar)<br>
                      2. In <a href="https://calendar.google.com" target="_blank" class="text-primary">Google Calendar</a>, go to calendar "Settings and sharing"<br>
                      3. Under "Access permissions" → Check "Make available to public"<br>
                      4. Copy the "Public URL in iCal format" from "Integrate calendar"<br>
                      <strong>⚠️ Warning:</strong> This makes the calendar PUBLIC. Only use for non-sensitive events.
                    </div>

                    <div class="text-weight-medium q-mb-sm">Other Calendars:</div>
                    <div class="text-grey-8">
                      Look for "Share", "Subscribe", or "iCal URL" options in your calendar settings.<br>
                      <strong>Remember:</strong> iCal URLs typically require public sharing. Consider creating a separate calendar for sharing sensitive events.
                    </div>
                  </div>
                </q-card>
              </q-expansion-item>
            </div>
          </q-form>
        </q-card-section>

        <q-card-actions align="right" class="q-pa-md">
          <q-btn
            flat
            label="Cancel"
            @click="showIcalDialog = false"
            :disable="creatingIcal"
          />
          <q-btn
            color="primary"
            label="Connect Calendar"
            @click="createIcalSource"
            :loading="creatingIcal"
            no-caps
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
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
