<script setup lang="ts">
import { useGroupStore } from 'stores/group-store.ts'
import { computed } from 'vue'
import { formatDate } from '../../utils/dateUtils.ts'
import NoContentComponent from 'components/common/NoContentComponent.vue'

const group = computed(() => useGroupStore().group)
</script>

<template>
  <div v-if="group" class="row q-col-gutter-md q-mt-md">

    <div class="col-12 col-md-6 col-lg-4">
      <!-- Description -->
      <q-card>
        <q-card-section>
          <div class="text-h5">What we’re about</div>
        </q-card-section>
        <q-separator/>
        <q-card-section>
          <div class="text-body1 q-mt-md">{{ group.description }}</div>
        </q-card-section>
      </q-card>

      <!-- Events List Section -->
      <q-card class="q-mt-lg">
        <q-card-section>
          <div class="text-h5">Upcoming Events</div>
        </q-card-section>
        <q-separator/>
        <q-list v-if="group.events && group.events.length">
          <q-item v-for="event in group.events" :key="event.id" clickable v-ripple>
            <q-item-section avatar>
              <q-icon name="sym_r_event" color="primary" size="md"/>
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ event.name }}</q-item-label>
              <q-item-label caption>
                {{ formatDate(event.startDate) }}
              </q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-btn flat color="primary" label="Details"
                     @click="$router.push({ name: 'EventPage', params: { id: event.id } })"/>
            </q-item-section>
          </q-item>
        </q-list>
        <NoContentComponent v-else icon="sym_r_event_busy" label="No upcoming events"/>
      </q-card>
    </div>

    <!-- Members List -->
    <div class="col-12 col-md-6 col-lg-4">
      <q-card>
        <q-card-section>
          <div class="text-h5">Members</div>
        </q-card-section>
        <q-separator/>
        <q-list v-if="group.members && group.members.length" style="max-height: 300px" class="scroll">
          <q-item v-for="member in group.members" :key="member.id">
            <q-item-section avatar>
              <q-avatar>
                <img :src="member.avatar">
              </q-avatar>
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ member.name }}</q-item-label>
              <q-item-label caption>{{ member.role }}</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
        <NoContentComponent v-else icon="sym_r_group" label="No members of this group yet."/>
      </q-card>
    </div>
  </div>
</template>

<style scoped lang="scss">

</style>
