<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { LoadingBar } from 'quasar'
import { getImageSrc } from 'src/utils/imageUtils.ts'
import DashboardTitle from 'src/components/dashboard/DashboardTitle.vue'
import { useProfileStore } from 'src/stores/profile-store'
import SpinnerComponent from 'src/components/common/SpinnerComponent.vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const user = computed(() => useProfileStore().user)
const interests = computed(() => useProfileStore().userInterests)
const ownedGroups = computed(() => useProfileStore().ownedGroups)
const organizedEvents = computed(() => useProfileStore().organizedEvents)
const groupMemberships = computed(() => useProfileStore().groupMemberships)

onMounted(async () => {
  LoadingBar.start()
  useProfileStore().actionGetProfile(route.params.id as string).finally(() => LoadingBar.stop())
})
</script>

<template>
  <q-page padding>
    <SpinnerComponent v-if="useProfileStore().isLoading"/>

    <div v-if="!useProfileStore().isLoading && user">
      <DashboardTitle defaultBack/>

      <div class="row q-col-gutter-md">

        <div class="col-12 col-sm-4">
            <!-- User Info -->
          <q-card flat bordered>
            <q-card-section>
              <div class="text-center">
                <q-avatar size="150px">
                  <img :src="getImageSrc(user.photo)" :alt="user.name" />
                </q-avatar>
                <h4 class="q-mt-md q-mb-xs">{{ user.name }}</h4>
                <p>{{ user.bio }}</p>
              </div>
            </q-card-section>
          </q-card>

          <q-card flat bordered class="q-mt-xl" v-if="user.id === useProfileStore().user?.id">
            <q-card-section horizontal>
                <q-avatar size="50px" class="q-mr-md">
                  <img :src="getImageSrc(user.photo)" :alt="user.name" />
                </q-avatar>
                <h4 class="q-mt-md q-mb-xs">{{ user.name }}</h4>
                <router-link :to="{ name: 'DashboardProfilePage'  }" class="router-link-inherit">Edit Profile</router-link>
            </q-card-section>
          </q-card>
        </div>

        <div class="col-12 col-sm-8">
       <!-- Interests -->
       <div class="col-12 col-md-8">
          <q-card flat bordered>
            <q-card-section>
              <div class="text-h5 text-bold">My Interests</div>
              <q-chip v-for="interest in interests" :key="interest.id" color="primary" text-color="white">
                {{ interest.title }}
              </q-chip>
            </q-card-section>
          </q-card>
        </div>

        <!-- Owned Groups -->
        <div class="col-12 col-md-6">
          <q-card flat bordered>
            <q-card-section>
              <div class="text-h6">Owned Groups</div>
              <q-list>
                <q-item v-for="group in ownedGroups" :key="group.id">
                  <q-item-section>
                    <q-item-label>{{ group.name }}</q-item-label>
                    <q-item-label caption>{{ group.groupMembersCount }} members</q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>
            </q-card-section>
          </q-card>
        </div>

        <!-- Organized Events -->
        <div class="col-12 col-md-6">
          <q-card flat bordered>
            <q-card-section>
              <div class="text-h6">Organized Events</div>
              <q-list>
                <q-item v-for="event in organizedEvents" :key="event.id">
                  <q-item-section>
                    <q-item-label>{{ event.name }}</q-item-label>
                    <q-item-label caption>{{ event.startDate }}</q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>
            </q-card-section>
          </q-card>
        </div>

        <!-- Group Memberships -->
        <div class="col-12">
          <q-card flat bordered>
            <q-card-section>
              <div class="text-h6">Group Memberships</div>
              <q-list>
                <q-item v-for="group in groupMemberships" :key="group.id">
                  <q-item-section>
                    <q-item-label>{{ group.name }}</q-item-label>
                    <q-item-label caption>{{ group.groupMembersCount }} members</q-item-label>
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
