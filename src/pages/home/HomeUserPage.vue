<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { LoadingBar, useQuasar } from 'quasar'
import SubtitleComponent from '../../components/common/SubtitleComponent.vue'
import { useAuthStore } from '../../stores/auth-store'
import { useHomeStore } from '../../stores/home-store'
import NoContentComponent from '../../components/global/NoContentComponent.vue'
import { useRouter } from 'vue-router'
import { getImageSrc } from '../../utils/imageUtils'
import { useNavigation } from '../../composables/useNavigation'
import { GroupEntity, EventEntity } from '../../types'
import GroupsListComponent from '../../components/group/GroupsListComponent.vue'
import EventsListComponent from '../../components/event/EventsListComponent.vue'
import { useEventDialog } from '../../composables/useEventDialog'
import UnifiedCalendarComponent from '../../components/calendar/UnifiedCalendarComponent.vue'
import { EventAttendeeStatus } from '../../types/event'
import SitewideFeedComponent from '../../components/activity-feed/SitewideFeedComponent.vue'

const userOrganizedGroups = computed(
  () => useHomeStore().userOrganizedGroups ?? []
)
const userNextHostedEvent = computed(() => useHomeStore().userNextHostedEvent)
const userRecentEventDrafts = computed(
  () => useHomeStore().userRecentEventDrafts
)
const userUpcomingEvents = computed(() => {
  const events = useHomeStore().userUpcomingEvents || []
  // Filter out events where user has cancelled their RSVP
  return events.filter(event => {
    return !event.attendee || event.attendee.status !== EventAttendeeStatus.Cancelled
  })
})
const userMemberGroups = computed(() => useHomeStore().userMemberGroups)
const router = useRouter()
const $q = useQuasar()

const { navigateToEvent } = useNavigation()
const { goToCreateEvent } = useEventDialog()

onMounted(() => {
  LoadingBar.start()
  useHomeStore().actionGetUserHomeState().finally(LoadingBar.stop)
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
      <!-- Introduction to OpenMeet -->
      <q-card flat bordered class="q-mb-md" :class="$q.dark.isActive ? 'bg-purple-600' : 'bg-purple-100'">
        <q-card-section>
          <div class="text-h5 q-mb-md" :class="$q.dark.isActive ? 'text-purple-200' : 'text-purple-400'">Welcome to OpenMeet, {{ useAuthStore().getUser.firstName || 'there' }}!</div>
          <p :class="$q.dark.isActive ? 'text-white' : ''">
            OpenMeet is a platform that helps you connect with like-minded people through
            groups and events. Create your own groups, organize events, or join existing
            communities to expand your network and share your interests.
          </p>
          <p class="q-mt-md" :class="$q.dark.isActive ? 'text-white' : ''">
            Get started by:
          </p>
          <div class="row q-col-gutter-md q-mt-sm">
            <!-- Browse actions in purple-300 -->
            <div class="col-auto">
              <q-btn
                :color="$q.dark.isActive ? 'purple-200' : 'purple-300'"
                to="/groups"
                label="Browse Groups"
                icon="sym_r_group"
                no-caps
                unelevated
                class="q-px-md"
              />
            </div>
            <div class="col-auto">
              <q-btn
                :color="$q.dark.isActive ? 'purple-200' : 'purple-300'"
                to="/events"
                label="Browse Events"
                icon="sym_r_event"
                no-caps
                unelevated
                class="q-px-md"
              />
            </div>

            <!-- Create actions in purple-400 -->
            <div class="col-auto">
              <q-btn
                :color="$q.dark.isActive ? 'purple-300' : 'purple-400'"
                icon="sym_r_add_circle"
                label="Create Group"
                no-caps
                unelevated
                class="q-px-md"
                @click="router.push({ name: 'DashboardGroupCreatePage' })"
              />
            </div>
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

            <!-- Profile action in purple-200 -->
            <div class="col-auto">
              <q-btn
                :color="$q.dark.isActive ? 'purple-400' : 'purple-200'"
                to="/dashboard/profile"
                label="Update Profile"
                icon="sym_r_settings"
                no-caps
                unelevated
                class="q-px-md"
              />
            </div>
          </div>
        </q-card-section>
      </q-card>

      <!-- Recent Activity Section -->
      <div class="q-mt-lg">
        <SitewideFeedComponent />
      </div>

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
              <q-card-section v-if="userRecentEventDrafts?.length">
                <q-list>
                  <q-item
                    data-cy="home-user-recent-event-drafts-item-component"
                    clickable
                    v-ripple
                    v-for="event in userRecentEventDrafts"
                    :key="event.id"
                    @click="navigateToEvent(event)"
                  >
                    <q-item-section thumbnail>
                      <q-img :src="getImageSrc(event.image)" />
                    </q-item-section>
                    <q-item-section>
                      <q-item-label>{{ event.name }}</q-item-label>
                      <q-item-label caption>{{
                        event.group?.name
                      }}</q-item-label>
                      <q-item-label caption>draft</q-item-label>
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
            :loading="useHomeStore().loading"
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

      <!-- Quick actions section -->
      <div class="q-mt-xl">
        <div class="text-h5 text-bold q-mb-md q-px-md" :class="$q.dark.isActive ? 'text-purple-200' : 'text-purple-400'">Quick Actions</div>
        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-6 col-md-3">
            <q-card flat bordered class="text-center" clickable @click="router.push({ name: 'GroupsPage' })">
              <q-card-section>
                <q-icon name="sym_r_group" size="3rem" :color="$q.dark.isActive ? 'purple-200' : 'purple-300'" />
                <div class="text-h6 q-mt-sm">Find Groups</div>
              </q-card-section>
            </q-card>
          </div>
          <div class="col-12 col-sm-6 col-md-3">
            <q-card flat bordered class="text-center" clickable @click="router.push({ name: 'EventsPage' })">
              <q-card-section>
                <q-icon name="sym_r_event" size="3rem" :color="$q.dark.isActive ? 'purple-200' : 'purple-300'" />
                <div class="text-h6 q-mt-sm">Discover Events</div>
              </q-card-section>
            </q-card>
          </div>
          <div class="col-12 col-sm-6 col-md-3">
            <q-card flat bordered class="text-center" clickable @click="router.push({ name: 'DashboardGroupCreatePage' })">
              <q-card-section>
                <q-icon name="sym_r_add_circle" size="3rem" :color="$q.dark.isActive ? 'purple-300' : 'purple-400'" />
                <div class="text-h6 q-mt-sm">Create Group</div>
              </q-card-section>
            </q-card>
          </div>
          <div class="col-12 col-sm-6 col-md-3">
            <q-card flat bordered class="text-center" clickable @click="goToCreateEvent()">
              <q-card-section>
                <q-icon name="sym_r_edit_calendar" size="3rem" :color="$q.dark.isActive ? 'purple-300' : 'purple-400'" />
                <div class="text-h6 q-mt-sm">Create Event</div>
              </q-card-section>
            </q-card>
          </div>
        </div>
      </div>
    </div>
  </q-page>
</template>
