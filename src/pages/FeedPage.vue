<script setup lang="ts">
import { useMeta } from 'quasar'
import SitewideFeedComponent from '../components/activity-feed/SitewideFeedComponent.vue'

useMeta({
  title: 'Activity Feed',
  meta: {
    description: {
      name: 'description',
      content: 'Discover what\'s happening across OpenMeet communities. See new groups, upcoming events, and trending activities.'
    }
  }
})
</script>

<template>
  <div class="feed-page">
    <div class="container q-pa-md">
      <div class="row justify-center">
        <div class="col-12 col-md-8 col-lg-6">
          <h3 class="text-h4 q-mb-md">Discover Activity</h3>
          <p class="text-body1 text-grey-7 q-mb-lg">
            See what's happening across our communities. Find new groups to join and events to attend.
          </p>
          <SitewideFeedComponent />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.feed-page {
  min-height: calc(100vh - 200px);
}

.container {
  max-width: 1200px;
  margin: 0 auto;
}
</style>
