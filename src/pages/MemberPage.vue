<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { LoadingBar } from 'quasar'
import { useAvatarUrl } from '../composables/useAvatarUrl'
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
const profileStore = useProfileStore()
const authStore = useAuthStore()

// The active profile being viewed
const profile = computed(() => profileStore.profile)

// Computed properties for the profile
const interests = computed(() => profile.value?.interests || [])
const ownedGroups = computed(() => profile.value?.ownedGroups || [])
const organizedEvents = computed(() => profile.value?.organizedEvents || [])
const attendingEvents = computed(() => profile.value?.attendingEvents || [])
const groupMemberships = computed(() => profile.value?.groupMemberships || [])
const counts = computed(() => profile.value?.counts)
const hasActivity = computed(() => {
  if (!counts.value) return false
  return counts.value.organizedEvents > 0 ||
    counts.value.attendingEvents > 0 ||
    counts.value.ownedGroups > 0 ||
    counts.value.groupMemberships > 0
})

// Auth provider flags
const isBskyUser = computed(() => profile.value?.provider === AuthProvidersEnum.bluesky)

// Get Bluesky handle - for shadow users, firstName contains the resolved handle
const bskyHandle = computed(() => {
  if (!profile.value) return null

  // Shadow users: firstName contains the resolved handle (e.g., "alice.bsky.social")
  if (profile.value.isShadowAccount && profile.value.firstName) {
    return profile.value.firstName
  }

  // Real users: check preferences for handle (legacy)
  return profile.value?.preferences?.bluesky?.handle || null
})

const isGoogleUser = computed(() => profile.value?.provider === AuthProvidersEnum.google)
const isGithubUser = computed(() => profile.value?.provider === AuthProvidersEnum.github)

// Profile avatar - create a computed ref for useAvatarUrl
// Cast to UserEntity since we only use photo and preferences fields
const profileUser = computed(() => {
  if (!profile.value) return null
  return {
    photo: profile.value.photo ? { path: profile.value.photo.path } : undefined,
    firstName: profile.value.firstName,
    lastName: profile.value.lastName,
    preferences: profile.value.preferences
  } as unknown as import('../types').UserEntity
})
const { avatarUrl } = useAvatarUrl(profileUser)

// Display name - for Bluesky users, show resolved handle
const displayName = computed(() => {
  if (isBskyUser.value && bskyHandle.value) {
    // If handle doesn't look like a DID, use it with @ prefix
    if (!bskyHandle.value.startsWith('did:')) {
      return `@${bskyHandle.value}`
    }
    // If it's still a DID (shouldn't happen with backend resolution), show it without @
    return bskyHandle.value
  }

  // For non-Bluesky users, use firstName + lastName
  const firstName = profile.value?.firstName || ''
  const lastName = profile.value?.lastName || ''
  return `${firstName} ${lastName}`.trim() || 'Anonymous User'
})

// Check if this is the current user's profile
const isOwnProfile = computed(() => {
  return profile.value && authStore.user && profile.value.id === authStore.user.id
})

onMounted(async () => {
  LoadingBar.start()
  await profileStore.actionGetProfileSummary(route.params.slug as string)
    .finally(() => LoadingBar.stop())
})
</script>

<template>
  <q-page padding class="q-pb-xl q-mx-auto" style="max-width: 1201px">
    <SpinnerComponent v-if="profileStore.isLoading" />

    <div v-if="!profileStore.isLoading && profile">
      <div class="row q-col-gutter-md">
        <div class="col-12 col-sm-4">
          <!-- User Info -->
          <q-card flat bordered v-if="profile">
            <q-card-section>
              <div class="text-center">
                <q-avatar size="150px">
                  <img :src="avatarUrl" :alt="`${profile.firstName || ''} ${profile.lastName || ''}`" />
                </q-avatar>
                <h4 class="q-mt-md text-h5 text-bold q-mb-xs profile-name">
                  {{ displayName }}
                </h4>
                <div
                  data-cy="user-bio"
                  class="text-body1 q-mt-md bio-content"
                >
                  <q-markdown
                    v-if="profile.bio"
                    :src="profile.bio"
                  />
                  <div v-else class="text-grey-6 text-italic">No bio provided</div>
                </div>
              </div>
            </q-card-section>
          </q-card>

          <!-- Stats Summary - clean text style -->
          <div v-if="counts && hasActivity" class="text-body2 text-grey-7 q-mt-md text-center summary-line">
            <span v-if="counts.organizedEvents > 0">
              <strong class="text-primary">{{ counts.organizedEvents }}</strong> organized
            </span>
            <span v-if="counts.organizedEvents > 0 && counts.attendingEvents > 0" class="separator">·</span>
            <span v-if="counts.attendingEvents > 0">
              <strong class="text-secondary">{{ counts.attendingEvents }}</strong> attending
            </span>
            <span v-if="(counts.organizedEvents > 0 || counts.attendingEvents > 0) && counts.ownedGroups > 0" class="separator">·</span>
            <span v-if="counts.ownedGroups > 0">
              <strong>{{ counts.ownedGroups }}</strong> groups
            </span>
            <span v-if="(counts.organizedEvents > 0 || counts.attendingEvents > 0 || counts.ownedGroups > 0) && counts.groupMemberships > 0" class="separator">·</span>
            <span v-if="counts.groupMemberships > 0">
              <strong>{{ counts.groupMemberships }}</strong> memberships
            </span>
          </div>

          <!-- Edit Profile Link (only shown if viewing your own profile) -->
          <q-card
            flat
            bordered
            class="q-mt-xl"
            v-if="isOwnProfile"
          >
            <q-card-section horizontal>
              <q-avatar size="50px" class="q-mr-md">
                <img :src="avatarUrl" :alt="displayName" />
              </q-avatar>
              <div class="column">
                <div class="text-bold">{{ displayName }}</div>
                <router-link
                  :to="{ name: 'DashboardProfilePage' }"
                  class="router-link-inherit"
                  >Edit Profile</router-link
                >
              </div>
            </q-card-section>
          </q-card>

          <!-- Bluesky Info -->
          <q-card flat bordered class="q-mt-md" v-if="isBskyUser && profile">
            <q-card-section>
              <div class="text-center">
                <q-icon name="fa-brands fa-bluesky" color="primary" size="2rem" />
                <h6 class="q-mt-sm q-mb-none">AT Protocol User</h6>
                <div class="text-body2 q-mt-sm" v-if="bskyHandle">
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
          <q-card flat bordered class="q-mt-md" v-if="isGoogleUser && profile">
            <q-card-section>
              <div class="text-center">
                <q-icon name="fa-brands fa-google" color="primary" size="2rem" />
                <h6 class="q-mt-sm q-mb-none">Google User</h6>
              </div>
            </q-card-section>
          </q-card>
          <!-- Github Info -->
          <q-card flat bordered class="q-mt-md" v-if="isGithubUser && profile">
            <q-card-section>
              <div class="text-center">
                <q-icon name="fa-brands fa-github" color="primary" size="2rem" />
                <h6 class="q-mt-sm q-mb-none">Github User</h6>
                <h6 class="q-mt-sm q-mb-none" v-if="profile.socialId">
                  <a :href="`https://github.com/${profile.socialId}`" target="_blank" class="text-primary">
                    {{ displayName }}
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
                :label="counts && counts.ownedGroups > ownedGroups.length ? `Owned Groups (showing ${ownedGroups.length} of ${counts.ownedGroups})` : 'Owned Groups'"
                :groups="ownedGroups"
                :show-pagination="false"
                :current-page="1"
                :loading="profileStore.isLoading"
                empty-message="There are no groups yet."
                layout="grid"
                :hide-link="!isOwnProfile"
                :to="{ name: 'DashboardMyGroupsPage', query: { role: 'leader' } }"
                link-text="See all"
              />
            </q-card-section>
          </q-card>

          <!-- Organized Events -->
          <q-card flat bordered class="q-mb-lg" v-if="organizedEvents?.length">
            <q-card-section>
              <SubtitleComponent
                :count="counts?.organizedEvents || organizedEvents.length"
                :hide-link="!isOwnProfile"
                :to="{ name: 'DashboardMyEventsPage', query: { tab: 'hosting' } }"
                :label="counts && counts.organizedEvents > organizedEvents.length ? `Organized Events (showing ${organizedEvents.length})` : 'Organized Events'"
              />
              <EventsItemComponent
                v-for="event in organizedEvents"
                :key="event.id"
                :event="event"
              />
            </q-card-section>
          </q-card>

          <!-- Attending Events -->
          <q-card flat bordered class="q-mb-lg" v-if="attendingEvents?.length">
            <q-card-section>
              <SubtitleComponent
                :count="counts?.attendingEvents || attendingEvents.length"
                :hide-link="!isOwnProfile"
                :to="{ name: 'DashboardMyEventsPage', query: { tab: 'attending' } }"
                :label="counts && counts.attendingEvents > attendingEvents.length ? `Attending Events (showing ${attendingEvents.length})` : 'Attending Events'"
              />
              <EventsItemComponent
                v-for="event in attendingEvents"
                :key="event.id"
                :event="event"
              />
            </q-card-section>
          </q-card>

          <!-- Group Memberships -->
          <q-card flat bordered class="q-mb-lg" v-if="groupMemberships?.length">
            <q-card-section>
              <SubtitleComponent
                :count="counts?.groupMemberships || groupMemberships.length"
                :hide-link="!isOwnProfile"
                :to="{ name: 'DashboardMyGroupsPage', query: { role: 'member' } }"
                :label="counts && counts.groupMemberships > groupMemberships.length ? `Group Memberships (showing ${groupMemberships.length})` : 'Group Memberships'"
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
      v-else-if="!profileStore.isLoading"
      label="Profile not found"
      icon="sym_r_info"
      :to="{ name: 'HomePage' }"
      button-label="Go to Home page"
    />
  </q-page>
</template>

<style lang="scss" scoped>
.profile-name {
  word-wrap: break-word;
  overflow-wrap: break-word;
  word-break: break-word;
  max-width: 100%;
}

.summary-line {
  .separator {
    margin: 0 0.5rem;
    color: #ccc;
  }
}

.bio-content {
  max-width: 100%;

  :deep(a) {
    color: var(--q-primary);
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }

    &::after {
      display: none;
    }
  }

  :deep(img) {
    max-width: 100%;
    border-radius: 4px;
  }

  :deep(code) {
    background-color: rgba(0, 0, 0, 0.05);
    padding: 2px 4px;
    border-radius: 4px;
    font-family: monospace;
  }

  :deep(blockquote) {
    border-left: 4px solid var(--q-primary);
    margin-left: 0;
    padding-left: 16px;
    color: rgba(0, 0, 0, 0.7);
  }
}
</style>
