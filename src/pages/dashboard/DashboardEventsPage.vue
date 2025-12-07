<template>
  <q-page padding style="max-width: 1024px" class="q-mx-auto q-pb-xl">
    <SpinnerComponent v-if="!loaded" />

    <template v-if="loaded">
      <div class="row justify-between items-start">
        <DashboardTitle defaultBack label="Your events" />
        <q-btn no-caps color="primary" icon="sym_r_add" label="Add New Event" @click="onAddNewEvent" />
      </div>

      <!-- Stats Summary - clean text style -->
      <div class="text-body2 text-grey-7 q-mt-md q-mb-lg summary-line">
        <span v-if="summary?.counts.hostingUpcoming">
          <strong class="text-primary">{{ summary.counts.hostingUpcoming }}</strong> hosting
        </span>
        <span v-if="summary?.counts.hostingUpcoming && summary?.counts.attendingUpcoming" class="separator">·</span>
        <span v-if="summary?.counts.attendingUpcoming">
          <strong class="text-secondary">{{ summary.counts.attendingUpcoming }}</strong> attending
        </span>
        <span v-if="(summary?.counts.hostingUpcoming || summary?.counts.attendingUpcoming) && summary?.counts.past" class="separator">·</span>
        <span
          v-if="summary?.counts.past"
          class="past-link"
          @click="showPastEvents = true"
        >
          <strong>{{ summary.counts.past }}</strong> past
        </span>
      </div>

      <!-- No events state -->
      <NoContentComponent
        v-if="!hasAnyEvents"
        @click="onAddNewEvent"
        buttonLabel="Create your first event"
        label="You don't have any upcoming events"
        icon="sym_r_event"
      />

      <!-- Hosting This Week -->
      <template v-if="summary?.hostingThisWeek?.length">
        <div class="text-h6 q-mb-sm flex items-center">
          <q-icon name="sym_r_calendar_today" class="q-mr-sm" color="primary" />
          Hosting This Week
          <q-badge color="primary" class="q-ml-sm">{{ summary.hostingThisWeek.length }}</q-badge>
        </div>
        <div class="q-mb-lg">
          <EventsItemComponent
            v-for="event in summary.hostingThisWeek"
            :key="event.id"
            :event="event"
            layout="list"
          />
        </div>
      </template>

      <!-- Hosting Later -->
      <template v-if="summary?.hostingLater?.length">
        <div class="text-h6 q-mb-sm flex items-center justify-between">
          <div class="flex items-center">
            <q-icon name="sym_r_event_upcoming" class="q-mr-sm" color="primary" />
            Hosting Later
            <q-badge v-if="moreHostingCount > 0" color="grey-6" class="q-ml-sm">
              {{ moreHostingCount }} more
            </q-badge>
          </div>
          <q-btn
            v-if="moreHostingCount > 0"
            flat
            no-caps
            color="primary"
            label="View all"
            icon-right="sym_r_arrow_forward"
            @click="viewAllHosting"
          />
        </div>
        <div class="q-mb-lg">
          <EventsItemComponent
            v-for="event in summary.hostingLater"
            :key="event.id"
            :event="event"
            layout="list"
          />
        </div>
      </template>

      <!-- Attending Soon -->
      <template v-if="summary?.attendingSoon?.length">
        <div class="text-h6 q-mb-sm flex items-center justify-between">
          <div class="flex items-center">
            <q-icon name="sym_r_how_to_reg" class="q-mr-sm" color="secondary" />
            Attending Soon
            <q-badge v-if="moreAttendingCount > 0" color="grey-6" class="q-ml-sm">
              {{ moreAttendingCount }} more
            </q-badge>
          </div>
          <q-btn
            v-if="moreAttendingCount > 0"
            flat
            no-caps
            color="primary"
            label="View all"
            icon-right="sym_r_arrow_forward"
            @click="viewAllAttending"
          />
        </div>
        <div class="q-mb-lg">
          <EventsItemComponent
            v-for="event in summary.attendingSoon"
            :key="event.id"
            :event="event"
            layout="list"
          />
        </div>
      </template>

      <!-- Past Events Link -->
      <q-separator v-if="summary?.counts.past" class="q-my-md" />
      <div v-if="summary?.counts.past" class="text-center">
        <q-btn
          flat
          no-caps
          color="grey-7"
          icon="sym_r_history"
          :label="`Browse ${summary.counts.past} past events`"
          @click="showPastEvents = true"
        />
      </div>
    </template>

    <!-- Past Events Dialog -->
    <q-dialog v-model="showPastEvents" maximized>
      <q-card>
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">Past Events</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>
        <q-card-section class="q-pt-none">
          <div v-if="loadingPast" class="text-center q-pa-xl">
            <q-spinner size="lg" color="primary" />
          </div>
          <div v-else-if="pastEvents.length">
            <EventsItemComponent
              v-for="event in pastEvents"
              :key="event.id"
              :event="event"
              layout="list"
            />
          </div>
          <NoContentComponent
            v-else
            label="No past events"
            icon="sym_r_history"
          />
        </q-card-section>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { LoadingBar, useMeta } from 'quasar'
import { useRouter } from 'vue-router'
import { DashboardSummaryEntity, EventEntity } from '../../types'
import EventsItemComponent from '../../components/event/EventsItemComponent.vue'
import DashboardTitle from '../../components/dashboard/DashboardTitle.vue'
import SpinnerComponent from '../../components/common/SpinnerComponent.vue'
import NoContentComponent from '../../components/global/NoContentComponent.vue'
import { eventsApi } from '../../api'

const loaded = ref(false)
const router = useRouter()
const summary = ref<DashboardSummaryEntity | null>(null)

// Past events state
const showPastEvents = ref(false)
const loadingPast = ref(false)
const pastEvents = ref<EventEntity[]>([])

// Computed values
const hasAnyEvents = computed(() => {
  if (!summary.value) return false
  return (
    summary.value.hostingThisWeek.length > 0 ||
    summary.value.hostingLater.length > 0 ||
    summary.value.attendingSoon.length > 0
  )
})

const moreHostingCount = computed(() => {
  if (!summary.value) return 0
  const shown = summary.value.hostingThisWeek.length + summary.value.hostingLater.length
  return Math.max(0, summary.value.counts.hostingUpcoming - shown)
})

const moreAttendingCount = computed(() => {
  if (!summary.value) return 0
  return Math.max(0, summary.value.counts.attendingUpcoming - summary.value.attendingSoon.length)
})

useMeta({
  title: 'Your events'
})

onMounted(async () => {
  LoadingBar.start()
  try {
    const res = await eventsApi.getDashboardSummary()
    summary.value = res.data
  } finally {
    LoadingBar.stop()
    loaded.value = true
  }
})

// Load past events when dialog opens
watch(showPastEvents, async (isOpen) => {
  if (isOpen && pastEvents.value.length === 0) {
    loadingPast.value = true
    try {
      // For now, use the legacy endpoint and filter client-side
      // TODO: Create a dedicated past events endpoint with pagination
      const res = await eventsApi.getDashboardEvents()
      pastEvents.value = res.data
        .filter(event => event.startDate && new Date(event.startDate) < new Date())
        .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
    } finally {
      loadingPast.value = false
    }
  }
})

const onAddNewEvent = () => {
  router.push({ name: 'DashboardEventCreatePage' })
}

const viewAllHosting = () => {
  // TODO: Navigate to paginated hosting events view
  router.push({ name: 'EventsPage', query: { hosting: 'true' } })
}

const viewAllAttending = () => {
  // TODO: Navigate to paginated attending events view
  router.push({ name: 'EventsPage', query: { attending: 'true' } })
}
</script>

<style scoped lang="scss">
.text-h6 {
  font-weight: 500;
}

.summary-line {
  .separator {
    margin: 0 0.5rem;
    color: #ccc;
  }

  .past-link {
    cursor: pointer;
    text-decoration: underline;
    text-decoration-style: dotted;
    text-underline-offset: 2px;

    &:hover {
      color: var(--q-primary);
    }
  }
}
</style>
