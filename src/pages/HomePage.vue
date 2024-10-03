<template>
  <q-page class="q-pa-md">
    <div class="row q-col-gutter-md">
      <!-- Hero Section -->
      <div class="col-12" v-if="!useAuthStore().isAuthenticated">
        <q-card class="bg-primary text-white">
          <q-card-section class="text-center q-pa-lg">
            <h1 class="text-h3 q-mb-md">Welcome to OpenMeet</h1>
            <p class="text-h6">Connect, Share, and Grow with Like-minded People</p>
            <q-btn color="white" text-color="primary" label="Join Now" @click="onJoinNowClick" class="q-mt-md"
                   size="lg"/>
          </q-card-section>
        </q-card>
      </div>

      <!-- Featured Groups Section -->
      <div class="col-12 col-md-8">
        <h2 class="text-h4 q-mb-md">Featured Groups</h2>
        <div class="row q-col-gutter-md">
          <div v-for="group in featuredGroups" :key="group.id" class="col-12 col-sm-6">
            <q-card class="group-card">
              <q-img :src="group.imageUrl" :ratio="16/9">
                <div class="absolute-bottom text-subtitle2 text-center bg-black-4 full-width">
                  {{ group.name }}
                </div>
              </q-img>
              <q-card-section>
                <div class="text-h6">{{ group.name }}</div>
                <div class="text-subtitle2">{{ group.category }}</div>
              </q-card-section>
              <q-card-section class="q-pt-none">
                {{ truncateDescription(group.description) }}
              </q-card-section>
              <q-card-actions align="right">
                <q-btn flat color="primary" label="View Group" @click="viewGroup(group.id)"/>
              </q-card-actions>
            </q-card>
          </div>
        </div>
        <div class="text-center q-mt-md">
          <q-btn color="primary" label="Explore All Groups" @click="exploreGroups"/>
        </div>
      </div>

      <!-- Upcoming Events Section -->
      <div class="col-12 col-md-4">
        <h2 class="text-h4 q-mb-md">Upcoming Events</h2>
        <q-list bordered separator>
          <q-item v-for="event in upcomingEvents" :key="event.id" clickable v-ripple @click="viewEvent(event.id)">
            <q-item-section avatar>
              <q-icon name="sym_r_event" color="primary" size="md"/>
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ event.title }}</q-item-label>
              <q-item-label caption>
                {{ formatDate(event.date) }} at {{ event.time }}
              </q-item-label>
              <q-item-label caption>
                Organized by {{ event.groupName }}
              </q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
        <div class="text-center q-mt-md">
          <q-btn color="secondary" label="View All Events" @click="viewAllEvents"/>
        </div>
      </div>

      <div class="col-12">
        <h2 class="text-h4 q-mb-md">Categories</h2>
        <div class="row q-gutter-md">
            <HomeCategoryComponent
              v-for="category in categories"
              :key="category.name"
              :category="category"
            />
        </div>
      </div>

      <div class="col-12">
        <h2 class="text-h4 q-mb-md">Interests</h2>
        <HomeInterestsComponent :interests="interests"/>
      </div>

      <!-- Additional Information Section -->
      <div class="col-12" v-if="!useAuthStore().isAuthenticated">
        <q-card class="q-mt-lg" :class="[Dark.isActive ? 'bg-dark-gray text-white': 'bg-grey-2']">
          <q-card-section>
            <div class="row q-col-gutter-md">
              <div class="col-12 col-md-4">
                <h3 class="text-h5">Why Join OpenMeet?</h3>
                <q-list>
                  <q-item v-for="(reason, index) in reasons" :key="index">
                    <q-item-section avatar>
                      <q-icon :name="reason.icon" color="primary"/>
                    </q-item-section>
                    <q-item-section>
                      <q-item-label>{{ reason.text }}</q-item-label>
                    </q-item-section>
                  </q-item>
                </q-list>
              </div>
              <div class="col-12 col-md-4">
                <h3 class="text-h5">How It Works</h3>
                <q-timeline color="secondary">
                  <q-timeline-entry v-for="(step, index) in howItWorks" :key="index" :title="step.title"
                                    :subtitle="step.subtitle" :icon="step.icon"/>
                </q-timeline>
              </div>
              <div class="col-12 col-md-4">
                <h3 class="text-h5">Get Started Now</h3>
                <p>Join our community today and start connecting with people who share your interests!</p>
                <q-btn @click="openRegisterDialog" color="primary" label="Create an Account" class="q-mt-md"/>
              </div>
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Dark, date, LoadingBar } from 'quasar'
import { useRouter } from 'vue-router'
import { apiHome } from 'src/api/home.ts'
import { useAuthDialog } from 'src/composables/useAuthDialog.ts'
import { useAuthStore } from 'stores/auth-store.ts'
import HomeCategoryComponent from 'components/home/HomeCategoryComponent.vue'
import HomeInterestsComponent from 'components/home/HomeInterestsComponent.vue'

const { openLoginDialog, openRegisterDialog } = useAuthDialog()

const router = useRouter()

interface Group {
  id: number;
  name: string;
  category: string;
  description: string;
  imageUrl: string;
}

interface Event {
  id: number;
  title: string;
  date: string;
  time: string;
  groupName: string;
}

interface Category {
  name: string;
}

interface Interest {
  name: string;
  description: string;
}

const categories: Category[] = [
  { name: 'Technology' },
  { name: 'Art' },
  { name: 'Sports' }
]

const interests: Interest[] = [
  { name: 'Programming', description: 'Learn how to code and create apps.' },
  { name: 'Painting', description: 'Express yourself through art and colors.' },
  { name: 'Soccer', description: 'Play the most popular sport in the world.' }
]

const onJoinNowClick = () => {
  openLoginDialog()
}

const featuredGroups = ref<Group[]>([
  {
    id: 1,
    name: 'Tech Enthusiasts',
    category: 'Technology',
    description: 'A group for tech lovers to discuss the latest trends and innovations in technology.',
    imageUrl: 'https://cdn.quasar.dev/img/mountains.jpg'
  },
  {
    id: 2,
    name: 'Outdoor Adventures',
    category: 'Sports & Fitness',
    description: 'Join us for exciting hiking trips and outdoor adventures!',
    imageUrl: 'https://cdn.quasar.dev/img/parallax1.jpg'
  },
  {
    id: 3,
    name: 'Book Lovers Club',
    category: 'Arts & Culture',
    description: 'Monthly meetups to discuss great books and share our love for literature.',
    imageUrl: 'https://cdn.quasar.dev/img/parallax2.jpg'
  },
  {
    id: 4,
    name: 'Foodies Unite',
    category: 'Food & Drink',
    description: 'Explore culinary delights and share your passion for food with fellow enthusiasts.',
    imageUrl: 'https://cdn.quasar.dev/img/quasar.jpg'
  }
])

const upcomingEvents = ref<Event[]>([
  { id: 1, title: 'AI Workshop', date: '2023-07-15', time: '14:00', groupName: 'Tech Enthusiasts' },
  { id: 2, title: 'Mountain Hike', date: '2023-07-22', time: '08:00', groupName: 'Outdoor Adventures' },
  { id: 3, title: 'Book Discussion: 1984', date: '2023-07-29', time: '19:00', groupName: 'Book Lovers Club' },
  { id: 4, title: 'Wine Tasting Event', date: '2023-08-05', time: '18:30', groupName: 'Foodies Unite' }
])

const reasons = [
  { icon: 'sym_r_people', text: 'Connect with like-minded individuals' },
  { icon: 'sym_r_event', text: 'Attend exciting events and meetups' },
  { icon: 'sym_r_school', text: 'Learn and grow through shared experiences' },
  { icon: 'sym_r_public', text: 'Expand your social and professional network' }
]

const howItWorks = [
  { title: 'Create an Account', subtitle: 'Sign up and set up your profile', icon: 'sym_r_person_add' },
  { title: 'Join Groups', subtitle: 'Find groups that match your interests', icon: 'sym_r_group_add' },
  { title: 'Attend Events', subtitle: 'Participate in group activities and meetups', icon: 'sym_r_event_available' },
  { title: 'Connect and Share', subtitle: 'Engage with other members and share experiences', icon: 'sym_r_chat' }
]

const truncateDescription = (description: string, length: number = 100) => {
  return description.length > length
    ? description.substring(0, length) + '...'
    : description
}

const formatDate = (dateString: string) => {
  return date.formatDate(dateString, 'MMMM D, YYYY')
}

const viewGroup = (groupId: number) => {
  console.log('View group:', groupId)
  // In a real app, you'd navigate to the group details page
  router.push({ name: 'GroupPage', params: { id: groupId } })
}

const exploreGroups = () => {
  console.log('Explore all groups')
  // In a real app, you'd navigate to the groups listing page
  router.push({ name: 'GroupsPage' })
}

const viewEvent = (eventId: number) => {
  console.log('View event:', eventId)
  // In a real app, you'd navigate to the event details page
  router.push({ name: 'EventPage', params: { id: eventId } })
}

const viewAllEvents = () => {
  console.log('View all events')
  // In a real app, you'd navigate to the events listing page
  router.push({ name: 'EventsPage' })
}

onMounted(() => {
  LoadingBar.start()
  apiHome().finally(LoadingBar.stop)
})
</script>

<style scoped>
.group-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.group-card .q-card__section:nth-last-child(2) {
  flex-grow: 1;
}
</style>
