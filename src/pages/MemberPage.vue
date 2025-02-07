<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { LoadingBar } from 'quasar'
import { getImageSrc } from '../utils/imageUtils'
import { useProfileStore } from '../stores/profile-store'
import SpinnerComponent from '../components/common/SpinnerComponent.vue'
import { useRoute } from 'vue-router'
import SubtitleComponent from '../components/common/SubtitleComponent.vue'
import { useAuthStore } from '../stores/auth-store'
import NoContentComponent from '../components/global/NoContentComponent.vue'
import GroupsItemComponent from '../components/group/GroupsItemComponent.vue'
import EventsItemComponent from '../components/event/EventsItemComponent.vue'
import GroupsListComponent from '../components/group/GroupsListComponent.vue'
import { AuthProvidersEnum } from '../types'
const route = useRoute()

const user = computed(() => useProfileStore().user)
const interests = computed(() => useProfileStore().user?.interests)
const ownedGroups = computed(() => useProfileStore().user?.groups)
const organizedEvents = computed(() => useProfileStore().user?.events)
const groupMemberships = computed(() =>
  useProfileStore().user?.groupMembers?.filter(
    (member) => member.groupRole?.name !== 'owner'
  )
)

const isBskyUser = computed(() => user.value?.provider === AuthProvidersEnum.bluesky)
const bskyHandle = computed(() => isBskyUser.value ? user.value?.socialId : null)
const isGoogleUser = computed(() => user.value?.provider === AuthProvidersEnum.google)
const isGithubUser = computed(() => user.value?.provider === AuthProvidersEnum.github)

onMounted(async () => {
  LoadingBar.start()
  await useProfileStore().actionGetMemberProfile(route.params.slug as string)
    .finally(() => LoadingBar.stop())
})
</script>

<template>
  <q-page padding class="q-pb-xl q-mx-auto" style="max-width: 1201px">
    <SpinnerComponent v-if="useProfileStore().isLoading" />

    <div v-if="!useProfileStore().isLoading && user">
      <div class="row q-col-gutter-md">
        <div class="col-12 col-sm-4">
          <!-- User Info -->
          <q-card flat bordered>
            <q-card-section>
              <div class="text-center">
                <q-avatar size="150px">
                  <img :src="getImageSrc(user.photo)" :alt="user.name" />
                </q-avatar>
                <h4 class="q-mt-md text-h5 text-bold q-mb-xs">
                  {{ user.name }}
                </h4>
                <div class="text-body2">{{ user.bio }}</div>
              </div>
            </q-card-section>
          </q-card>

          <q-card
            flat
            bordered
            class="q-mt-xl"
            v-if="user.id === useAuthStore().user?.id"
          >
            <q-card-section horizontal>
              <q-avatar size="50px" class="q-mr-md">
                <img :src="getImageSrc(user.photo)" :alt="user.name" />
              </q-avatar>
              <div class="column">
                <div class="text-bold">{{ user.name }}</div>
                <router-link
                  :to="{ name: 'DashboardProfilePage' }"
                  class="router-link-inherit"
                  >Edit Profile</router-link
                >
              </div>
            </q-card-section>
          </q-card>

          <!-- Bluesky Info -->
          <q-card flat bordered class="q-mt-md" v-if="isBskyUser">
            <q-card-section>
              <div class="text-center">
                <q-icon name="fa-brands fa-bluesky" color="primary" size="2rem" />
                <h6 class="q-mt-sm q-mb-none">Bluesky User</h6>
                <div class="text-body2 q-mt-sm">
                  <a
                    :href="`https://bsky.app/profile/${bskyHandle}`"
                    target="_blank"
                    class="text-primary"
                  >
                    @{{ bskyHandle }}
                  </a>
                </div>
              </div>
            </q-card-section>
          </q-card>
          <!-- Google Info -->
          <q-card flat bordered class="q-mt-md" v-if="isGoogleUser">
            <q-card-section>
              <div class="text-center">
                <q-icon name="fa-brands fa-google" color="primary" size="2rem" />
                <h6 class="q-mt-sm q-mb-none">Google User</h6>
              </div>
            </q-card-section>
          </q-card>
          <!-- Github Info -->
          <q-card flat bordered class="q-mt-md" v-if="isGithubUser">
            <q-card-section>
              <div class="text-center">
                <q-icon name="fa-brands fa-github" color="primary" size="2rem" />
                <h6 class="q-mt-sm q-mb-none">
                  <a :href="`https://github.com/${user.name}`" target="_blank" class="text-primary">
                    {{ user.name }}
                  </a>
                </h6>
              </div>
            </q-card-section>
          </q-card>

        </div>

        <div class="col-12 col-sm-8">
          <!-- Interests -->
          <q-card class="q-mb-lg" flat bordered v-if="interests?.length">
            <q-card-section>
              <SubtitleComponent
                :count="interests.length"
                hide-link
                label="My Interests"
              />
              <q-chip
                v-for="interest in interests"
                :key="interest.id"
                color="primary"
                text-color="white"
              >
                {{ interest.title }}
              </q-chip>
            </q-card-section>
          </q-card>

          <!-- Owned Groups -->
          <q-card flat bordered class="q-mb-lg" v-if="ownedGroups?.length">
            <q-card-section>
              <GroupsListComponent
                label="Owned Groups"
                :groups="ownedGroups"
                :show-pagination="false"
                :current-page="1"
                :loading="useProfileStore().isLoading"
                empty-message="There are no groups yet."
                layout="grid"
              />
            </q-card-section>
          </q-card>

          <!-- Organized Events -->
          <q-card flat bordered class="q-mb-lg" v-if="organizedEvents?.length">
            <q-card-section>
              <SubtitleComponent
                :count="organizedEvents.length"
                hide-link
                label="Organized Events"
              />
              <EventsItemComponent
                v-for="event in organizedEvents"
                :key="event.id"
                :event="event"
              />
            </q-card-section>
          </q-card>

          <!-- Group Memberships -->
          <q-card flat bordered class="q-mb-lg" v-if="groupMemberships?.length">
            <q-card-section>
              <SubtitleComponent
                :count="groupMemberships.length"
                hide-link
                label="Group Memberships"
              />
              <GroupsItemComponent
                v-for="groupMember in groupMemberships"
                :key="groupMember.id"
                :group="groupMember.group"
              />
            </q-card-section>
          </q-card>
        </div>
      </div>
    </div>
    <NoContentComponent
      v-else
      label="Profile not found"
      icon="sym_r_info"
      :to="{ name: 'HomePage' }"
      button-label="Go to Home page"
    />
  </q-page>
</template>
