<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { LoadingBar } from 'quasar'
import SubtitleComponent from 'components/common/SubtitleComponent.vue'
import { useAuthStore } from 'stores/auth-store.ts'
import SpinnerComponent from 'components/common/SpinnerComponent.vue'
import { useHomeStore } from 'src/stores/home-store'
import EventsItemComponent from 'src/components/event/EventsItemComponent.vue'

const userOrganizedGroups = computed(() => useHomeStore().userOrganizedGroups)
const userNextHostedEvent = computed(() => useHomeStore().userNextHostedEvent)
const userRecentEventDrafts = computed(() => useHomeStore().userRecentEventDrafts)
const userUpcomingEvents = computed(() => useHomeStore().userUpcomingEvents)
const userMemberGroups = computed(() => useHomeStore().userMemberGroups)
const userInterests = computed(() => useHomeStore().userInterests)

const loading = ref(false)

onMounted(() => {
  LoadingBar.start()
  useHomeStore().actionGetUserHomeState().finally(LoadingBar.stop)
})

</script>

<template>
  <q-page padding>
    <SpinnerComponent v-if="loading"/>

    <div v-if="!loading">
      <!-- Content for authorized users -->
      <div>
        <h2>{{ `Welcome back, ${useAuthStore().getUser.name}!` }}</h2>

        <div class="row q-col-gutter-xl">
          <div class="col-12 col-sm-7">
            <!-- Groups you organize -->
            <SubtitleComponent v-if="userOrganizedGroups" label="Groups you organize" :count="userOrganizedGroups.length" :to="{ name: 'DashboardGroupsPage' }"/>
            <q-card v-if="userOrganizedGroups" flat bordered class="col column q-mb-md">
              <q-card-section>
                <q-list>
                  <q-item v-for="group in userOrganizedGroups" :key="group.id">
                    <q-item-section>
                      <q-item-label>{{ group.name }}</q-item-label>
                      <q-item-label caption>{{ group.groupMembersCount }} members</q-item-label>
                    </q-item-section>
                  </q-item>
                </q-list>
              </q-card-section>
            </q-card>
          </div>
          <div class="col-12 col-sm-5">
            <!-- Next event you're hosting -->
            <SubtitleComponent label="Next events you're hosting" :to="{ name: 'DashboardEventsPage' }"/>
            <q-card v-if="userNextHostedEvent" flat bordered class="q-mb-md">
              <q-card-section>
                <q-item>
                  <q-item-section>
                    <q-item-label>{{ userNextHostedEvent.name }}</q-item-label>
                    <q-item-label caption>{{ userNextHostedEvent.startDate }} | {{ userNextHostedEvent.location }}</q-item-label>
                  </q-item-section>
                </q-item>
              </q-card-section>
            </q-card>

            <!-- Recent event drafts -->
            <SubtitleComponent v-if="userRecentEventDrafts" label="Recent event drafts" :count="userRecentEventDrafts.length" :to="{ name: 'DashboardEventsPage' }"/>
            <q-card v-if="userRecentEventDrafts && userRecentEventDrafts.length" flat bordered class="q-mb-md">
              <q-card-section>
                <q-list>
                  <q-item v-for="event in userRecentEventDrafts" :key="event.id">
                    <q-item-section>
                      <q-item-label>{{ event.name }}</q-item-label>
                      <q-item-label caption>{{ event.startDate }} | {{ event.location }}</q-item-label>
                    </q-item-section>
                  </q-item>
                </q-list>
              </q-card-section>
            </q-card>
          </div>
        </div>

        <div class="text-h5 text-bold q-my-xl">Upcoming events</div>
        <div class="row q-col-gutter-xl">
          <div class="col-12 col-sm-4">

            <!-- Calendar -->
            <q-card flat bordered class="q-mb-xl">
                <q-date
                  class="full-width"
                  model-value="2024/10/11"
                  :events="['2024/10/01', '2024/11/05', '2024/09/06', '2024/12/09', '2025/01/23']"
                  :event-color="(date: string) => (date[9] as any % 2 === 0) ? 'teal' : 'orange'"
                />
            </q-card>

            <!-- Groups you're part of -->
            <SubtitleComponent v-if="userMemberGroups" label="Groups you're part of" :count="userMemberGroups.length" :to="{ name: 'DashboardGroupsPage' }"/>
            <q-card v-if="userMemberGroups && userMemberGroups.length" flat bordered class="q-mb-xl">
              <q-card-section>
                <q-list>
                  <q-item v-for="group in userMemberGroups" :key="group.id">
                    <q-item-section>
                      <q-item-label>{{ group.name }}</q-item-label>
                      <q-item-label caption>{{ group.groupMembersCount }} members</q-item-label>
                    </q-item-section>
                  </q-item>
                </q-list>
              </q-card-section>
            </q-card>

            <!-- Your interests -->
            <SubtitleComponent v-if="userInterests" label="Your interests"/>
            <q-card v-if="userInterests && userInterests.length" class="q-mb-md">
              <q-card-section>
                <div class="q-gutter-sm">
                  <q-chip v-for="interest in userInterests" :key="interest.id" color="primary" text-color="white">
                    {{ interest.title }}
                  </q-chip>
                </div>
              </q-card-section>
            </q-card>
          </div>
          <div class="col-12 col-sm-8">
            <!-- Upcoming events list -->
            <div v-for="event in userUpcomingEvents" :key="event.id" class="col-12 col-sm-6 col-md-4">
              <EventsItemComponent :event="event"/>
            </div>
          </div>
        </div>
      </div>
    </div>
  </q-page>
</template>
