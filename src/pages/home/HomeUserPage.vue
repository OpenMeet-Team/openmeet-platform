<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { LoadingBar } from 'quasar'
import SubtitleComponent from 'components/common/SubtitleComponent.vue'
import { useAuthStore } from 'stores/auth-store.ts'
import SpinnerComponent from 'components/common/SpinnerComponent.vue'
import { useHomeStore } from 'src/stores/home-store'
import EventsItemComponent from 'src/components/event/EventsItemComponent.vue'
import NoContentComponent from 'components/global/NoContentComponent.vue'
import { useRouter } from 'vue-router'
import { getImageSrc } from 'src/utils/imageUtils'
import { useNavigation } from 'src/composables/useNavigation'
import { GroupEntity } from 'src/types'

const userOrganizedGroups = computed(() => useHomeStore().userOrganizedGroups)
const userNextHostedEvent = computed(() => useHomeStore().userNextHostedEvent)
const userRecentEventDrafts = computed(() => useHomeStore().userRecentEventDrafts)
const userUpcomingEvents = computed(() => useHomeStore().userUpcomingEvents)
const userMemberGroups = computed(() => useHomeStore().userMemberGroups)
const userInterests = computed(() => useHomeStore().userInterests)
const router = useRouter()

const { navigateToGroup, navigateToEvent } = useNavigation()

onMounted(() => {
  LoadingBar.start()
  useHomeStore().actionGetUserHomeState().finally(LoadingBar.stop)
})

const onCreateEvent = (group: GroupEntity) => {
  router.push({ name: 'DashboardEventCreatePage', query: { group: group.id } })
}
</script>

<template>
  <q-page padding data-cy="home-user-page">
    <SpinnerComponent v-if="useHomeStore().loading" />

    <div v-if="!useHomeStore().loading">
      <!-- Content for authorized users -->
      <div>
        <div class="text-h2">{{ useAuthStore().getUser.name ? `Welcome back, ${useAuthStore().getUser.name}!` : 'Welcome!' }}</div>

        <div class="row q-col-gutter-xl q-mt-md">
          <div class="col-12 col-md-7">
            <!-- Groups you organize -->
            <SubtitleComponent class="q-px-md" label="Groups you organize" :to="{ name: 'DashboardGroupsPage' }" />
            <q-card flat bordered class="col column q-mb-md">
              <q-card-section v-if="userOrganizedGroups?.length">
                <q-list>
                  <q-item data-cy="organized-groups-item-component" v-ripple v-for="group in userOrganizedGroups" :key="group.id"
                    clickable @click="navigateToGroup(group)">
                    <q-item-section thumbnail>
                      <img :src="getImageSrc(group.image)">
                    </q-item-section>
                    <q-item-section>
                      <q-item-label class="text-h6">{{ group.name }}</q-item-label>
                      <q-item-label caption>{{ group.groupMembersCount }} members</q-item-label>
                      <div class="row q-mt-sm">
                        <q-btn dense color="primary" size="md" no-caps icon="sym_r_add_circle"
                          @click.stop="onCreateEvent(group)" label="Create event" />
                      </div>
                    </q-item-section>
                  </q-item>
                </q-list>
              </q-card-section>
              <NoContentComponent v-else icon="sym_r_group" button-label="Create your own group"
                :to="{ name: 'DashboardGroupsPage' }" label="You have no groups yet" />
            </q-card>
          </div>
          <div class="col-12 col-md-5">
            <!-- Next event you're hosting -->
            <SubtitleComponent class="q-px-md" label="Next events you're hosting" :to="{ name: 'DashboardEventsPage' }" />
            <q-card flat bordered class="q-mb-md">
              <q-card-section v-if="userNextHostedEvent">
                <q-item data-cy="next-hosted-event-item-component" v-ripple clickable
                  @click="navigateToEvent(userNextHostedEvent)">
                  <q-item-section thumbnail>
                    <img :src="getImageSrc(userNextHostedEvent.image)">
                  </q-item-section>
                  <q-item-section>
                    <q-item-label class="text-h6">{{ userNextHostedEvent.name }}</q-item-label>
                    <q-item-label caption>{{ userNextHostedEvent.startDate }} | {{ userNextHostedEvent.location
                      }}</q-item-label>
                  </q-item-section>
                </q-item>
              </q-card-section>
              <NoContentComponent v-if="!userNextHostedEvent" icon="sym_r_event" button-label="Create your own event"
                :to="{ name: 'DashboardEventsPage' }" label="You have no upcoming events" />
            </q-card>

            <!-- Recent event drafts -->
            <template v-if="userRecentEventDrafts?.length">
              <SubtitleComponent label="Recent event drafts" hide-link />
              <q-card flat bordered class="q-mb-md">
                <q-card-section v-if="userRecentEventDrafts?.length">
                  <q-list>
                    <q-item data-cy="recent-event-drafts-item-component" clickable v-ripple v-for="event in userRecentEventDrafts"
                      :key="event.id" @click="navigateToEvent(event)">
                      <q-item-section thumbnail>
                        <q-img :src="getImageSrc(event.image)" />
                      </q-item-section>
                      <q-item-section>
                        <q-item-label>{{ event.name }}</q-item-label>
                        <q-item-label caption>{{ event.group?.name }}</q-item-label>
                        <q-item-label overline>draft</q-item-label>
                      </q-item-section>
                    </q-item>
                  </q-list>
                </q-card-section>
                <NoContentComponent v-if="!userRecentEventDrafts?.length" icon="sym_r_event"
                  button-label="Create your own event" :to="{ name: 'DashboardEventsPage' }"
                  label="You have no recent event drafts" />
              </q-card>
            </template>
          </div>
        </div>

        <div class="text-h5 text-bold q-my-xl q-px-md">Upcoming events</div>
        <div class="row q-col-gutter-xl">
          <div class="col-12 col-md-4">

            <!-- Calendar -->
            <q-card flat bordered class="q-mb-xl gt-sm">
              <q-date class="full-width" model-value="2024/10/11"
                :events="['2024/10/01', '2024/11/05', '2024/09/06', '2024/12/09', '2025/01/23']"
                :event-color="(date: string) => (date[9] as any % 2 === 0) ? 'teal' : 'orange'" />
            </q-card>

            <!-- Groups you're part of -->
            <SubtitleComponent class="q-px-md" label="Groups you're part of" :hide-link="!userMemberGroups?.length"
              :count="userMemberGroups?.length" :to="{ name: 'DashboardGroupsPage' }" />
            <q-card flat bordered class="q-mb-xl">
              <q-card-section v-if="userMemberGroups?.length">
                <q-list>
                  <q-item data-cy="member-groups-item-component" v-for="group in userMemberGroups" :key="group.id"
                    clickable @click="navigateToGroup(group)">
                    <q-item-section>
                      <q-item-label>{{ group.name }}</q-item-label>
                      <q-item-label caption>{{ group.groupMembersCount }} members</q-item-label>
                    </q-item-section>
                  </q-item>
                </q-list>
              </q-card-section>
              <NoContentComponent v-else button-label="Browse groups" icon="sym_r_group"
                label="You are not a member of any groups" :to="{ name: 'GroupsPage' }" />
            </q-card>

            <!-- Your interests -->
            <SubtitleComponent class="q-px-md" hide-link label="Your interests" />
            <q-card flat bordered class="q-mb-md">
              <q-card-section v-if="userInterests?.length">
                <div class="q-gutter-sm">
                  <q-chip data-cy="interests-item-component" v-for="interest in userInterests" :key="interest.id"
                    color="primary" text-color="white">
                    {{ interest.title }}
                  </q-chip>
                </div>
              </q-card-section>
              <NoContentComponent v-else icon="sym_r_interests" label="You have no interests" />
            </q-card>
          </div>
          <div class="col-12 col-md-8">
            <!-- Upcoming events list -->
            <div v-for="event in userUpcomingEvents" :key="event.id" class="col-12 col-sm-6 col-md-4">
              <EventsItemComponent data-cy="upcoming-events-item-component" :event="event" />
            </div>
            <NoContentComponent v-if="!userUpcomingEvents?.length" icon="sym_r_event"
              label="You have no upcoming events" />
          </div>
        </div>
      </div>
    </div>
  </q-page>
</template>
