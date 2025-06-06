<template>
  <q-page padding>
    <SpinnerComponent v-if="useHomeStore().loading" />
    <div v-if="!useHomeStore().loading" class="row q-col-gutter-md">

      <HomeHeroComponent />

      <!-- Introduction Section -->
      <div class="col-12 q-mt-lg">
        <div class="q-px-md">
          <div class="text-body1 q-mb-md">
            Connect with your community through interest groups, professional networks, and local events. OpenMeet makes it easy to find like-minded people and organize meaningful gatherings.
          </div>

          <div class="text-body2">
            <strong>Private by design.</strong> No ads, no data selling, just real connections.
          </div>
        </div>
      </div>

      <!-- Quick actions section similar to logged-in view -->
      <div class="col-12 q-mt-xl">
        <div class="text-h5 text-bold q-mb-md q-px-md" :class="Dark.isActive ? 'text-purple-200' : 'text-purple-400'">Explore OpenMeet</div>
        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-6 col-md-3">
            <q-card flat bordered class="text-center" clickable @click="$router.push({ name: 'GroupsPage' })">
              <q-card-section>
                <q-icon name="sym_r_group" size="3rem" :color="Dark.isActive ? 'purple-200' : 'purple-300'" />
                <div class="text-h6 q-mt-sm">Find Groups</div>
              </q-card-section>
            </q-card>
          </div>
          <div class="col-12 col-sm-6 col-md-3">
            <q-card flat bordered class="text-center" clickable @click="$router.push({ name: 'EventsPage' })">
              <q-card-section>
                <q-icon name="sym_r_event" size="3rem" :color="Dark.isActive ? 'purple-200' : 'purple-300'" />
                <div class="text-h6 q-mt-sm">Discover Events</div>
              </q-card-section>
            </q-card>
          </div>
          <div class="col-12 col-sm-6 col-md-3">
            <q-card flat bordered class="text-center" clickable @click="goToRegister">
              <q-card-section>
                <q-icon name="sym_r_person_add" size="3rem" :color="Dark.isActive ? 'purple-300' : 'purple-400'" />
                <div class="text-h6 q-mt-sm">Create Account</div>
              </q-card-section>
            </q-card>
          </div>
          <div class="col-12 col-sm-6 col-md-3">
            <q-card flat bordered class="text-center" clickable @click="goToLogin()">
              <q-card-section>
                <q-icon name="sym_r_login" size="3rem" :color="Dark.isActive ? 'purple-300' : 'purple-400'" />
                <div class="text-h6 q-mt-sm">Sign In</div>
              </q-card-section>
            </q-card>
          </div>
        </div>
      </div>

      <!-- Featured Groups Section -->
      <div class="col-12 q-mt-lg">
        <!-- Featured Groups -->
        <GroupsListComponent data-cy="home-featured-groups"
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
        <EventsListComponent data-cy="home-upcoming-events"
          :events="upcomingEvents as EventEntity[]"
          label="Upcoming Events"
          :show-pagination="false"
          :current-page="1"
          :loading="useHomeStore().loading"
          empty-message="No events found"
          layout="grid"
        />
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { Dark, LoadingBar, useMeta } from 'quasar'
import { useAuth } from '../../composables/useAuth'
import { useHomeStore } from '../../stores/home-store'
import SpinnerComponent from '../../components/common/SpinnerComponent.vue'
import HomeHeroComponent from '../../components/home/HomeHeroComponent.vue'
import GroupsListComponent from '../../components/group/GroupsListComponent.vue'
import { GroupEntity } from '../../types/group'
import { EventEntity } from '../../types'
import EventsListComponent from '../../components/event/EventsListComponent.vue'

const { goToRegister, goToLogin } = useAuth()
const featuredGroups = computed(() => useHomeStore().guestFeaturedGroups)
const upcomingEvents = computed(() => useHomeStore().guestUpcomingEvents)

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
