<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useQuasar } from 'quasar'
import SubtitleComponent from 'components/common/SubtitleComponent.vue'
import { useAuthStore } from 'stores/auth-store.ts'
import SpinnerComponent from 'components/common/SpinnerComponent.vue'

interface Group {
  id: number;
  name: string;
  members: number;
}

interface Event {
  id: number;
  name: string;
  date: string;
  location: string;
}

interface Interest {
  id: number;
  name: string;
}

const $q = useQuasar()

const organizedGroups = ref<Group[]>([])
const nextHostedEvent = ref<Event | null>(null)
const recentEventDrafts = ref<Event[]>([])
const upcomingEvents = ref<Event[]>([])
const memberGroups = ref<Group[]>([])
const interests = ref<Interest[]>([])

const loading = ref(true)

onMounted(async () => {
  // Simulate checking auth status
  try {
    await Promise.all([
      fetchOrganizedGroups(),
      fetchNextHostedEvent(),
      fetchRecentEventDrafts(),
      fetchUpcomingEvents(),
      fetchMemberGroups(),
      fetchInterests()
    ])
  } catch (error) {
    $q.notify({
      color: 'negative',
      message: 'Failed to load user data',
      icon: 'error'
    })
  } finally {
    loading.value = false
  }
})

async function fetchOrganizedGroups () {
  // Simulated API call
  organizedGroups.value = [
    { id: 1, name: 'Tech Enthusiasts', members: 120 },
    { id: 2, name: 'Weekend Hikers', members: 85 }
  ]
}

async function fetchNextHostedEvent () {
  // Simulated API call
  nextHostedEvent.value = {
    id: 1,
    name: 'Annual Tech Conference',
    date: '2024-11-15',
    location: 'San Francisco, CA'
  }
}

async function fetchRecentEventDrafts () {
  // Simulated API call
  recentEventDrafts.value = [
    { id: 2, name: 'Mountain Trail Hike', date: '2024-07-22', location: 'Rocky Mountains' },
    { id: 3, name: 'Photography Workshop', date: '2024-08-05', location: 'New York City' }
  ]
}

async function fetchUpcomingEvents () {
  // Simulated API call
  upcomingEvents.value = [
    { id: 4, name: 'Local Tech Meetup', date: '2024-06-10', location: 'San Jose, CA' },
    { id: 5, name: 'City Photography Walk', date: '2024-06-15', location: 'Chicago, IL' },
    { id: 6, name: 'Startup Networking Event', date: '2024-06-20', location: 'Austin, TX' }
  ]
}

async function fetchMemberGroups () {
  // Simulated API call
  memberGroups.value = [
    { id: 3, name: 'Local Photographers', members: 50 },
    { id: 4, name: 'City Explorers', members: 200 }
  ]
}

async function fetchInterests () {
  // Simulated API call
  interests.value = [
    { id: 1, name: 'Technology' },
    { id: 2, name: 'Hiking' },
    { id: 3, name: 'Photography' }
  ]
}

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
            <SubtitleComponent label="Groups you organize" :count="organizedGroups.length" :to="{ name: 'DashboardGroupsPage' }"/>
            <q-card v-if="organizedGroups.length" flat bordered class="col column q-mb-md">
              <q-card-section>
                <q-list>
                  <q-item v-for="group in organizedGroups" :key="group.id">
                    <q-item-section>
                      <q-item-label>{{ group.name }}</q-item-label>
                      <q-item-label caption>{{ group.members }} members</q-item-label>
                    </q-item-section>
                  </q-item>
                </q-list>
              </q-card-section>
            </q-card>
          </div>
          <div class="col-12 col-sm-5">
            <!-- Next event you're hosting -->
            <SubtitleComponent label="Next events you're hosting" :to="{ name: 'DashboardEventsPage' }"/>
            <q-card v-if="nextHostedEvent" flat bordered class="q-mb-md">
              <q-card-section>
                <q-item>
                  <q-item-section>
                    <q-item-label>{{ nextHostedEvent.name }}</q-item-label>
                    <q-item-label caption>{{ nextHostedEvent.date }} | {{ nextHostedEvent.location }}</q-item-label>
                  </q-item-section>
                </q-item>
              </q-card-section>
            </q-card>

            <!-- Recent event drafts -->
            <SubtitleComponent label="Recent event drafts" :count="recentEventDrafts.length" :to="{ name: 'DashboardEventsPage' }"/>
            <q-card v-if="recentEventDrafts.length" flat bordered class="q-mb-md">
              <q-card-section>
                <q-list>
                  <q-item v-for="event in recentEventDrafts" :key="event.id">
                    <q-item-section>
                      <q-item-label>{{ event.name }}</q-item-label>
                      <q-item-label caption>{{ event.date }} | {{ event.location }}</q-item-label>
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
            <SubtitleComponent label="Groups you're part of" :count="memberGroups.length" :to="{ name: 'DashboardGroupsPage' }"/>
            <q-card flat bordered class="q-mb-xl">
              <q-card-section>
                <q-list>
                  <q-item v-for="group in memberGroups" :key="group.id">
                    <q-item-section>
                      <q-item-label>{{ group.name }}</q-item-label>
                      <q-item-label caption>{{ group.members }} members</q-item-label>
                    </q-item-section>
                  </q-item>
                </q-list>
              </q-card-section>
            </q-card>

            <!-- Your interests -->
            <SubtitleComponent label="Your interests"/>
            <q-card v-if="interests.length" class="q-mb-md">
              <q-card-section>
                <div class="q-gutter-sm">
                  <q-chip v-for="interest in interests" :key="interest.id" color="primary" text-color="white">
                    {{ interest.name }}
                  </q-chip>
                </div>
              </q-card-section>
            </q-card>
          </div>
          <div class="col-12 col-sm-8">
            <!-- Upcoming events list -->
            <q-card v-if="upcomingEvents.length" class="q-mb-md">
              <q-card-section>
                <div class="text-h6">Upcoming events</div>
                <q-list>
                  <q-item v-for="event in upcomingEvents" :key="event.id">
                    <q-item-section>
                      <q-item-label>{{ event.name }}</q-item-label>
                      <q-item-label caption>{{ event.date }} | {{ event.location }}</q-item-label>
                    </q-item-section>
                  </q-item>
                </q-list>
              </q-card-section>
            </q-card>
          </div>
        </div>
      </div>
    </div>
  </q-page>
</template>
