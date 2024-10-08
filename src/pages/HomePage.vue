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
            <HomeGroupItem :group="group" @view="onViewGroup"/>
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
          <HomeEventItem :events="upcomingEvents" @view="viewEvent"/>
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
import { Dark, LoadingBar } from 'quasar'
import { useRouter } from 'vue-router'
import { apiHome } from 'src/api/home.ts'
import { useAuthDialog } from 'src/composables/useAuthDialog.ts'
import { useAuthStore } from 'stores/auth-store.ts'
import HomeCategoryComponent from 'components/home/HomeCategoryComponent.vue'
import HomeInterestsComponent from 'components/home/HomeInterestsComponent.vue'
import HomeGroupItem from 'components/home/HomeGroupItemComponent.vue'
import { EventEntity, GroupEntity } from 'src/types'
import HomeEventItem from 'components/home/HomeEventItemComponent.vue'

const { openLoginDialog, openRegisterDialog } = useAuthDialog()

const router = useRouter()

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

const featuredGroups = ref<GroupEntity[]>([])

const upcomingEvents = ref<EventEntity[]>([])

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

const onViewGroup = (groupId: number) => {
  router.push({ name: 'GroupPage', params: { id: groupId } })
}

const exploreGroups = () => {
  router.push({ name: 'GroupsPage' })
}

const viewEvent = (eventId: number) => {
  router.push({ name: 'EventPage', params: { id: eventId } })
}

const viewAllEvents = () => {
  router.push({ name: 'EventsPage' })
}

onMounted(() => {
  LoadingBar.start()
  apiHome().finally(LoadingBar.stop).then(res => {
    featuredGroups.value = res.data.groups
    upcomingEvents.value = res.data.events
  })
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
