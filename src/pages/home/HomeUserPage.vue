<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { LoadingBar, useQuasar } from 'quasar'
import SubtitleComponent from '../../components/common/SubtitleComponent.vue'
import { useAuthStore } from '../../stores/auth-store'
import { useHomeStore } from '../../stores/home-store'
import NoContentComponent from '../../components/global/NoContentComponent.vue'
import { useRouter } from 'vue-router'
import { getImageSrc } from '../../utils/imageUtils'
import { formatRelativeTime } from '../../utils/dateUtils'
import { useNavigation } from '../../composables/useNavigation'
import { GroupEntity, EventEntity } from '../../types'
import GroupsListComponent from '../../components/group/GroupsListComponent.vue'
import EventsListComponent from '../../components/event/EventsListComponent.vue'
import { useEventDialog } from '../../composables/useEventDialog'
import UnifiedCalendarComponent from '../../components/calendar/UnifiedCalendarComponent.vue'
import { EventAttendeeStatus } from '../../types/event'
import SitewideFeedComponent from '../../components/activity-feed/SitewideFeedComponent.vue'
import { eventsApi } from '../../api/events'
import { useNotification } from '../../composables/useNotification'

const authStore = useAuthStore()
const homeStore = useHomeStore()

const userOrganizedGroups = computed(
  () => homeStore.userOrganizedGroups ?? []
)
const userNextHostedEvent = computed(() => homeStore.userNextHostedEvent)
const userRecentEventDrafts = computed(
  () => homeStore.userRecentEventDrafts
)
const userUpcomingEvents = computed(() => {
  const events = homeStore.userUpcomingEvents || []
  // Filter out events where user has cancelled their RSVP
  return events.filter(event => {
    return !event.attendee || event.attendee.status !== EventAttendeeStatus.Cancelled
  })
})
const userMemberGroups = computed(() => homeStore.userMemberGroups)
const router = useRouter()
const $q = useQuasar()

// Personalized stats
const firstName = computed(() => authStore.getUser?.firstName || 'there')
const hostingCount = computed(() => userNextHostedEvent.value ? 1 : 0)
const attendingCount = computed(() => userUpcomingEvents.value?.length || 0)
const groupCount = computed(() => (userOrganizedGroups.value?.length || 0) + (userMemberGroups.value?.length || 0))

const { navigateToEvent } = useNavigation()
const { goToCreateEvent } = useEventDialog()
const { success, error } = useNotification()

const onDeleteDraft = (event: EventEntity) => {
  $q.dialog({
    title: 'Delete Draft',
    message: `Are you sure you want to delete the draft '${event.name}'? This action cannot be undone.`,
    cancel: true,
    persistent: true
  }).onOk(async () => {
    try {
      await eventsApi.delete(event.slug)
      success('Draft deleted!')
      useHomeStore().actionGetUserHomeState()
    } catch (err) {
      console.error('Failed to delete draft:', err)
      error('Failed to delete draft. Please try again.')
    }
  })
}

onMounted(() => {
  LoadingBar.start()
  homeStore.actionGetUserHomeState().finally(LoadingBar.stop)
})

const onCreateEvent = (group: GroupEntity) => {
  router.push({ name: 'DashboardEventCreatePage', query: { group: group.id } })
}

const onCalendarEventClick = (calendarEvent: { type: string; title: string; slug?: string; groupSlug?: string }) => {
  if (calendarEvent.type === 'external-conflict') {
    // External calendar events - show info toast
    $q.notify({
      type: 'info',
      message: `External calendar event: ${calendarEvent.title}`,
      caption: 'This event is from your connected calendar'
    })
  } else if (calendarEvent.slug) {
    // OpenMeet events - navigate to event page
    if (calendarEvent.groupSlug) {
      router.push({ name: 'GroupPage', params: { slug: calendarEvent.groupSlug } })
    } else {
      router.push({ name: 'EventPage', params: { slug: calendarEvent.slug } })
    }
  }
}

const onCalendarDateClick = (date: string) => {
  // Open event creation dialog with pre-selected date
  goToCreateEvent(undefined, date)
}

const onCalendarDateSelect = () => {
  // Handle day selection (just for visual feedback, no action needed)
  // The calendar component handles the visual state internally
}
</script>

<template>
  <q-page padding data-cy="home-user-page">
    <div>
      <!-- Personalized Dashboard Header -->
      <q-card flat bordered class="q-mb-md" :class="$q.dark.isActive ? 'bg-purple-600' : 'bg-purple-100'">
        <q-card-section>
          <div class="row items-center justify-between">
            <div>
              <div class="text-h5" :class="$q.dark.isActive ? 'text-purple-200' : 'text-purple-400'">
                Welcome back, {{ firstName }}!
              </div>
              <div class="text-body2 q-mt-xs" :class="$q.dark.isActive ? 'text-purple-100' : 'text-grey-7'">
                <strong :class="$q.dark.isActive ? 'text-white' : 'text-purple-400'">{{ hostingCount }}</strong> hosting
                <span class="q-mx-xs">·</span>
                <strong :class="$q.dark.isActive ? 'text-white' : 'text-purple-400'">{{ attendingCount }}</strong> attending
                <span class="q-mx-xs">·</span>
                <strong :class="$q.dark.isActive ? 'text-white' : 'text-purple-400'">{{ groupCount }}</strong> groups
              </div>
            </div>
          </div>
          <div class="row q-col-gutter-md q-mt-md">
            <!-- Primary action -->
            <div class="col-auto">
              <q-btn
                :color="$q.dark.isActive ? 'purple-300' : 'purple-400'"
                icon="sym_r_add_circle"
                label="Create Event"
                no-caps
                unelevated
                class="q-px-md"
                @click="goToCreateEvent()"
              />
            </div>
            <!-- Secondary action -->
            <div class="col-auto">
              <q-btn
                outline
                :color="$q.dark.isActive ? 'purple-200' : 'purple-400'"
                icon="sym_r_group_add"
                label="Create Group"
                no-caps
                class="q-px-md"
                @click="router.push({ name: 'DashboardGroupCreatePage' })"
              />
            </div>
            <!-- Tertiary actions -->
            <div class="col-auto">
              <q-btn
                flat
                :color="$q.dark.isActive ? 'purple-100' : 'grey-7'"
                to="/groups"
                label="Browse Groups"
                no-caps
              />
            </div>
            <div class="col-auto">
              <q-btn
                flat
                :color="$q.dark.isActive ? 'purple-100' : 'grey-7'"
                to="/events"
                label="Browse Events"
                no-caps
              />
            </div>
          </div>
        </q-card-section>
      </q-card>

      <!-- Main content area -->
      <div class="row q-col-gutter-xl q-mt-md">
        <!-- Left column - Groups -->
        <div class="col-12 col-md-6">
          <div class="text-h5 text-bold q-mb-md q-px-md" :class="$q.dark.isActive ? 'text-purple-200' : 'text-purple-400'">Your Groups</div>

          <!-- Groups you organize -->
          <GroupsListComponent
            data-cy="home-user-organized-groups-component"
            :groups="userOrganizedGroups"
            :show-pagination="false"
            :current-page="1"
            empty-message="You have no groups yet"
            label="Groups you organize"
            layout="list"
            :hide-link="true"
          >
            <template #item-actions="{ group }">
              <q-btn
                dense
                :color="$q.dark.isActive ? 'purple-300' : 'purple-400'"
                size="md"
                no-caps
                icon="sym_r_add_circle"
                @click.stop="onCreateEvent(group)"
                label="Create event"
                unelevated
              />
            </template>
          </GroupsListComponent>

          <!-- Groups you're part of -->
          <GroupsListComponent
            class="q-mt-xl"
            data-cy="home-user-member-groups-item-component"
            :groups="userMemberGroups ?? []"
            :show-pagination="false"
            empty-message="You are not a member of any groups"
            layout="list"
            :current-page="1"
            label="Groups you're part of"
            :hide-link="true"
            :count="userMemberGroups?.length"
            :to="{ name: 'DashboardGroupsPage' }"
          >
            <template #empty>
              <NoContentComponent
                button-label="Browse groups"
                icon="sym_r_group"
                label="You are not a member of any groups"
                :to="{ name: 'GroupsPage' }"
              />
            </template>
          </GroupsListComponent>
        </div>

        <!-- Right column - Events -->
        <div class="col-12 col-md-6">
          <div class="text-h5 text-bold q-mb-md q-px-md" :class="$q.dark.isActive ? 'text-purple-200' : 'text-purple-400'">Your Events</div>

          <!-- Events you're hosting -->
          <EventsListComponent
            data-cy="home-user-hosted-events-component"
            :events="userNextHostedEvent ? [userNextHostedEvent] : []"
            :show-pagination="false"
            :current-page="1"
            empty-message="You have no hosting events"
            label="Events you're hosting"
            layout="list"
            :hide-link="true"
            :to="{ name: 'DashboardEventsPage' }"
          >
            <template #empty>
              <NoContentComponent
                icon="sym_r_event"
                button-label="Create your own event"
                :to="{ name: 'DashboardEventsPage' }"
                label="You have no hosting events"
              />
            </template>
          </EventsListComponent>

          <!-- Recent event drafts -->
          <template v-if="userRecentEventDrafts?.length">
            <SubtitleComponent
              class="q-px-md q-mt-xl"
              label="Recent event drafts"
              hide-link
            />
            <q-card flat bordered class="q-mb-md">
              <q-card-section v-if="userRecentEventDrafts?.length" class="q-pa-sm">
                <q-list separator>
                  <q-item
                    data-cy="home-user-recent-event-drafts-item-component"
                    clickable
                    v-ripple
                    v-for="event in userRecentEventDrafts"
                    :key="event.id"
                    @click="navigateToEvent(event)"
                    class="draft-item"
                  >
                    <q-item-section avatar>
                      <q-avatar rounded size="56px">
                        <q-img :src="getImageSrc(event.image)" :ratio="1" />
                      </q-avatar>
                    </q-item-section>
                    <q-item-section>
                      <q-item-label class="text-weight-medium">{{ event.name }}</q-item-label>
                      <q-item-label caption v-if="event.group?.name">
                        {{ event.group.name }}
                      </q-item-label>
                      <q-item-label caption>
                        <q-badge color="orange" text-color="white" class="q-mr-sm">
                          Draft
                        </q-badge>
                        <span :class="$q.dark.isActive ? 'text-grey-5' : 'text-grey-7'">
                          Updated {{ formatRelativeTime(event.updatedAt || event.createdAt || event.startDate) }}
                        </span>
                      </q-item-label>
                    </q-item-section>
                    <q-item-section side>
                      <q-btn
                        flat
                        round
                        dense
                        icon="sym_r_delete"
                        color="negative"
                        aria-label="Delete draft"
                        @click.stop="onDeleteDraft(event)"
                      >
                        <q-tooltip>Delete draft</q-tooltip>
                      </q-btn>
                    </q-item-section>
                  </q-item>
                </q-list>
              </q-card-section>
            </q-card>
          </template>

          <!-- Events you're attending -->
          <EventsListComponent
            class="q-mt-xl"
            :events="userUpcomingEvents as EventEntity[]"
            label="Events you're attending"
            :show-pagination="false"
            :current-page="1"
            :loading="homeStore.loading"
            empty-message="No events found"
            layout="list"
            :hide-link="true"
          >
            <template #empty>
              <NoContentComponent
                v-if="!userUpcomingEvents?.length"
                icon="sym_r_event"
                label="You have no upcoming events"
                button-label="Browse events"
                :to="{ name: 'EventsPage' }"
              />
            </template>
          </EventsListComponent>
        </div>
      </div>

      <!-- Recent Activity Section -->
      <div class="q-mt-xl">
        <SitewideFeedComponent />
      </div>

      <!-- Calendar Overview Section -->
      <div class="q-mt-xl">
        <div class="text-h5 text-bold q-mb-md q-px-md" :class="$q.dark.isActive ? 'text-purple-200' : 'text-purple-400'">Your Calendar</div>
        <q-card flat bordered>
          <q-card-section>
            <UnifiedCalendarComponent
              mode="month"
              :compact="true"
              height="350px"
              @event-click="onCalendarEventClick"
              @date-click="onCalendarDateClick"
              @date-select="onCalendarDateSelect"
            />
          </q-card-section>
        </q-card>
      </div>

    </div>
  </q-page>
</template>
