<template>
  <q-page padding>
    <SpinnerComponent v-if="useHomeStore().loading" />
    <div v-if="!useHomeStore().loading" class="row q-col-gutter-md">

      <HomeHeroComponent />

      <!-- Featured Groups Section -->
      <div class="col-12 q-mt-lg">
        <!-- Featured Groups -->
        <GroupsListComponent
          :groups="featuredGroups as GroupEntity[]"
          label="Featured Groups"
          :show-pagination="false"
          :current-page="1"
          :loading="useHomeStore().loading"
          empty-message="There are no groups yet."
          layout="grid"
        />
      </div>

      <!-- Upcoming Events Section -->
      <div class="col-12 q-mt-lg">
        <EventsListComponent
          :events="upcomingEvents as EventEntity[]"
          label="Upcoming Events"
          :show-pagination="false"
          :current-page="1"
          :loading="useHomeStore().loading"
          empty-message="No events found"
          layout="list"
        />
      </div>

      <div class="col-12 q-mt-xl">
        <SubtitleComponent class="q-px-md" hide-link label="Categories" />
        <div data-cy="home-categories" class="row q-gutter-md" v-if="categories?.length">
          <HomeCategoryComponent v-for="category in categories" :key="category.id" :category="category" />
        </div>
        <NoContentComponent v-if="!categories?.length" label="There are no categories yet." icon="sym_r_category" />
      </div>

      <div class="col-12 q-mt-lg">
        <SubtitleComponent class="q-px-md" hide-link label="Interests" />
        <div data-cy="home-interests" v-if="interests?.length">
          <HomeInterestsComponent :interests="interests" />
        </div>
        <NoContentComponent v-if="!interests?.length" label="There are no interests yet." icon="sym_r_interests" />
      </div>

      <!-- Additional Information Section -->
      <div class="col-12" v-if="!useAuthStore().isAuthenticated">
        <q-card flat bordered class="q-mt-lg" :class="[Dark.isActive ? 'bg-dark-gray text-white' : 'bg-grey-2']">
          <q-card-section>
            <div class="row q-col-gutter-md">
              <div class="col-12 col-md-4">
                <h3 class="text-h5">Why Join OpenMeet?</h3>
                <q-list>
                  <q-item v-for="(reason, index) in reasons" :key="index">
                    <q-item-section avatar>
                      <q-icon :name="reason.icon" color="primary" />
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
                    :subtitle="step.subtitle" :icon="step.icon" />
                </q-timeline>
              </div>
              <div class="col-12 col-md-4">
                <h3 class="text-h5">Get Started Now</h3>
                <p>Join our community today and start connecting with people who share your interests!</p>
                <q-btn @click="openRegisterDialog" color="primary" label="Create an Account" class="q-mt-md" />
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
import { useAuthDialog } from '../../composables/useAuthDialog'
import { useAuthStore } from '../../stores/auth-store'
import HomeCategoryComponent from '../../components/home/HomeCategoryComponent.vue'
import HomeInterestsComponent from '../../components/home/HomeInterestsComponent.vue'
import { useHomeStore } from '../../stores/home-store'
import SpinnerComponent from '../../components/common/SpinnerComponent.vue'
import SubtitleComponent from '../../components/common/SubtitleComponent.vue'
import HomeHeroComponent from '../../components/home/HomeHeroComponent.vue'
import GroupsListComponent from '../../components/group/GroupsListComponent.vue'
const { openRegisterDialog } = useAuthDialog()
import { GroupEntity } from '../../types/group'
import { EventEntity } from '../../types'
const categories = computed(() => useHomeStore().guestCategories)
const interests = computed(() => useHomeStore().guestInterests)
const featuredGroups = computed(() => useHomeStore().guestFeaturedGroups)
const upcomingEvents = computed(() => useHomeStore().guestUpcomingEvents)
import EventsListComponent from '../../components/event/EventsListComponent.vue'

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
