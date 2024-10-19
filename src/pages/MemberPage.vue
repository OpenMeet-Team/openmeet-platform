<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { getImageSrc } from 'src/utils/imageUtils.ts'

interface User {
  id: number;
  name: string;
  avatar: string;
  bio: string;
  photo?: string;
}

interface Interest {
  id: number;
  name: string;
}

interface Group {
  id: number;
  name: string;
  members: number;
}

interface Event {
  id: number;
  name: string;
  date: string;
}

const $q = useQuasar()

const user = ref<User | null>(null)
const interests = ref<Interest[]>([])
const ownedGroups = ref<Group[]>([])
const organizedEvents = ref<Event[]>([])
const groupMemberships = ref<Group[]>([])

const loading = ref(true)

onMounted(async () => {
  try {
    // Simulating API calls
    await Promise.all([
      fetchUserData(),
      fetchInterests(),
      fetchOwnedGroups(),
      fetchOrganizedEvents(),
      fetchGroupMemberships()
    ])
  } catch (error) {
    $q.notify({
      color: 'negative',
      message: 'Failed to load member data',
      icon: 'error'
    })
  } finally {
    loading.value = false
  }
})

async function fetchUserData () {
  // Simulated API call
  user.value = {
    id: 1,
    name: 'John Doe',
    avatar: 'https://cdn.quasar.dev/img/boy-avatar.png',
    bio: 'Enthusiastic event organizer and community builder'
  }
}

async function fetchInterests () {
  // Simulated API call
  interests.value = [
    { id: 1, name: 'Technology' },
    { id: 2, name: 'Hiking' },
    { id: 3, name: 'Photography' }
  ]
}

async function fetchOwnedGroups () {
  // Simulated API call
  ownedGroups.value = [
    { id: 1, name: 'Tech Enthusiasts', members: 120 },
    { id: 2, name: 'Weekend Hikers', members: 85 }
  ]
}

async function fetchOrganizedEvents () {
  // Simulated API call
  organizedEvents.value = [
    { id: 1, name: 'Annual Tech Conference', date: '2024-11-15' },
    { id: 2, name: 'Mountain Trail Hike', date: '2024-07-22' }
  ]
}

async function fetchGroupMemberships () {
  // Simulated API call
  groupMemberships.value = [
    { id: 3, name: 'Local Photographers', members: 50 },
    { id: 4, name: 'City Explorers', members: 200 }
  ]
}
</script>

<template>
  <q-page padding>
    <q-inner-loading :showing="loading">
      <q-spinner-gears size="50px" color="primary" />
    </q-inner-loading>

    <div v-if="!loading && user">
      <div class="row q-col-gutter-md">
        <!-- User Info -->
        <div class="col-12 col-md-4">
          <q-card flat bordered>
            <q-card-section>
              <div class="text-center">
                <q-avatar size="150px">
                  <img :src="getImageSrc(user.photo, 'https://placehold.co/100')" :alt="user.name" />
                </q-avatar>
                <h4 class="q-mt-md q-mb-xs">{{ user.name }}</h4>
                <p>{{ user.bio }}</p>
              </div>
            </q-card-section>
          </q-card>
        </div>

        <!-- Interests -->
        <div class="col-12 col-md-8">
          <q-card flat bordered>
            <q-card-section>
              <div class="text-h5 text-bold">My Interests</div>
              <q-chip v-for="interest in interests" :key="interest.id" color="primary" text-color="white">
                {{ interest.name }}
              </q-chip>
            </q-card-section>
          </q-card>
        </div>

        <!-- Owned Groups -->
        <div class="col-12 col-md-6">
          <q-card>
            <q-card-section>
              <div class="text-h6">Owned Groups</div>
              <q-list>
                <q-item v-for="group in ownedGroups" :key="group.id">
                  <q-item-section>
                    <q-item-label>{{ group.name }}</q-item-label>
                    <q-item-label caption>{{ group.members }} members</q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>
            </q-card-section>
          </q-card>
        </div>

        <!-- Organized Events -->
        <div class="col-12 col-md-6">
          <q-card>
            <q-card-section>
              <div class="text-h6">Organized Events</div>
              <q-list>
                <q-item v-for="event in organizedEvents" :key="event.id">
                  <q-item-section>
                    <q-item-label>{{ event.name }}</q-item-label>
                    <q-item-label caption>{{ event.date }}</q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>
            </q-card-section>
          </q-card>
        </div>

        <!-- Group Memberships -->
        <div class="col-12">
          <q-card>
            <q-card-section>
              <div class="text-h6">Group Memberships</div>
              <q-list>
                <q-item v-for="group in groupMemberships" :key="group.id">
                  <q-item-section>
                    <q-item-label>{{ group.name }}</q-item-label>
                    <q-item-label caption>{{ group.members }} members</q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>
            </q-card-section>
          </q-card>
        </div>
      </div>
    </div>
  </q-page>
</template>
