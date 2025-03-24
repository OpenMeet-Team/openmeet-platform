<template>
  <q-page padding>
    <SpinnerComponent v-if="useHomeStore().loading" />
    <div v-if="!useHomeStore().loading" class="row q-col-gutter-md">

      <HomeHeroComponent />

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
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { LoadingBar, useMeta } from 'quasar'

import HomeCategoryComponent from '../../components/home/HomeCategoryComponent.vue'
import { useHomeStore } from '../../stores/home-store'
import SpinnerComponent from '../../components/common/SpinnerComponent.vue'
import SubtitleComponent from '../../components/common/SubtitleComponent.vue'
import HomeHeroComponent from '../../components/home/HomeHeroComponent.vue'
import GroupsListComponent from '../../components/group/GroupsListComponent.vue'
import { GroupEntity } from '../../types/group'
import { EventEntity } from '../../types'
const categories = computed(() => useHomeStore().guestCategories)
const featuredGroups = computed(() => useHomeStore().guestFeaturedGroups)
const upcomingEvents = computed(() => useHomeStore().guestUpcomingEvents)
import EventsListComponent from '../../components/event/EventsListComponent.vue'

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
