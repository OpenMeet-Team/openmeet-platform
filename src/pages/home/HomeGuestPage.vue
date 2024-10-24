<template>
  <q-page padding>
    <SpinnerComponent v-if="useHomeStore().loading"/>
    <div v-if="!useHomeStore().loading" class="row q-col-gutter-md">
      <!-- Hero Section -->
      <div class="col-12 q-mb-xl">
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
        <SubtitleComponent hide-link label="Featured Groups"/>
        <NoContentComponent v-if="featuredGroups && !featuredGroups.length" label="There are no groups yet." icon="sym_r_groups"/>
        <template v-else>
            <div v-for="group in featuredGroups" :key="group.id">
              <GroupsItemComponent :group="group"/>
            </div>
          <div class="text-center q-mt-lg">
            <q-btn color="primary" label="Explore All Groups" @click="exploreGroups"/>
          </div>
        </template>
      </div>

      <!-- Upcoming Events Section -->
      <div class="col-12 col-md-4">
        <SubtitleComponent hide-link label="Upcoming Events" :to="{name: 'EventsPage'}"/>
        <NoContentComponent v-if="!upcomingEvents?.length" label="No events found" icon="sym_r_event"/>
        <template v-if="upcomingEvents?.length">
          <q-list bordered separator>
            <HomeEventItemComponent v-if="upcomingEvents?.length" :events="upcomingEvents"/>
          </q-list>
          <div class="text-center q-mt-md">
            <q-btn color="secondary" label="View All Events" @click="viewAllEvents"/>
          </div>
        </template>
      </div>

      <div class="col-12 q-mt-xl">
        <SubtitleComponent hide-link label="Categories"/>
        <div class="row q-gutter-md">
          <HomeCategoryComponent
            v-for="category in categories"
            :key="category.id"
            :category="category"
          />
        </div>
      </div>

      <div class="col-12">
        <SubtitleComponent hide-link label="Interests"/>
        <HomeInterestsComponent v-if="interests" :interests="interests"/>
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
import { onMounted, computed } from 'vue'
import { Dark, LoadingBar, useMeta } from 'quasar'
import { useRouter } from 'vue-router'
import { useAuthDialog } from 'src/composables/useAuthDialog.ts'
import { useAuthStore } from 'stores/auth-store.ts'
import HomeCategoryComponent from 'components/home/HomeCategoryComponent.vue'
import HomeInterestsComponent from 'components/home/HomeInterestsComponent.vue'
import { useHomeStore } from 'stores/home-store.ts'
import SpinnerComponent from 'src/components/common/SpinnerComponent.vue'
import HomeEventItemComponent from 'src/components/home/HomeEventItemComponent.vue'
import SubtitleComponent from 'src/components/common/SubtitleComponent.vue'
import GroupsItemComponent from 'src/components/group/GroupsItemComponent.vue'

const { openLoginDialog, openRegisterDialog } = useAuthDialog()

const router = useRouter()

const categories = computed(() => useHomeStore().guestCategories)
const interests = computed(() => useHomeStore().guestInterests)
const featuredGroups = computed(() => useHomeStore().guestFeaturedGroups)
const upcomingEvents = computed(() => useHomeStore().guestUpcomingEvents)

const onJoinNowClick = () => {
  openLoginDialog()
}

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

const exploreGroups = () => {
  router.push({ name: 'GroupsPage' })
}

const viewAllEvents = () => {
  router.push({ name: 'EventsPage' })
}

useMeta({
  title: 'Home'
})

onMounted(() => {
  LoadingBar.start()
  useHomeStore().actionGetGuestHomeState().finally(LoadingBar.stop)
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
