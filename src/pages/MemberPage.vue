<script setup lang="ts">
import { onMounted, computed, ref } from 'vue'
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
import { blueskyApi } from '../api/bluesky'
import { BlueskyEvent } from '../types/bluesky-event'

const route = useRoute()

const authStore = useAuthStore()
const user = computed(() => authStore.user)
const userProfile = computed(() => useProfileStore().user)
const interests = computed(() => userProfile.value?.interests)
const ownedGroups = computed(() => userProfile.value?.groups)
const organizedEvents = computed(() => userProfile.value?.events)
const groupMemberships = computed(() =>
  userProfile.value?.groupMembers?.filter(
    (member) => member.groupRole?.name !== 'owner'
  )
)

const isBskyUser = computed(() => user.value?.provider === AuthProvidersEnum.bluesky)
const bskyHandle = computed(() => isBskyUser.value ? authStore.getBlueskyHandle : null)
const isGoogleUser = computed(() => user.value?.provider === AuthProvidersEnum.google)
const isGithubUser = computed(() => user.value?.provider === AuthProvidersEnum.github)

const { avatarUrl } = useAvatarUrl(user)

const blueskyEvents = ref<BlueskyEvent[]>([])
const showDeleteConfirm = ref(false)
const deletingEvent = ref<string | null>(null)
const eventToDelete = ref<BlueskyEvent | null>(null)

const confirmDelete = (event: BlueskyEvent) => {
  if (!event?.value?.name) {
    return
  }
  eventToDelete.value = event
  showDeleteConfirm.value = true
}

const deleteEvent = async () => {
  if (!eventToDelete.value || !authStore.getBlueskyDid) return

  try {
    deletingEvent.value = eventToDelete.value.uri
    // Extract the record key from the URI (format: at://did:plc:xxx/community.lexicon.calendar.event/recordkey)
    const uriParts = eventToDelete.value.uri.split('/')
    const rkey = uriParts[uriParts.length - 1]

    if (!rkey) {
      throw new Error('Invalid event URI: Could not extract record key')
    }

    await blueskyApi.deleteEvent(authStore.getBlueskyDid, rkey)
    await loadBlueskyEvents()
    showDeleteConfirm.value = false
  } catch (err) {
    console.error('Failed to delete Bluesky event:', err)
  } finally {
    deletingEvent.value = null
    eventToDelete.value = null
  }
}

onMounted(async () => {
  LoadingBar.start()
  await Promise.all([
    useProfileStore().actionGetMemberProfile(route.params.slug as string),
    // Fetch Bluesky events if this is a Bluesky user
    isBskyUser.value && authStore.getBlueskyDid
      ? loadBlueskyEvents() : Promise.resolve()
  ]).finally(() => LoadingBar.stop())
})

const loadBlueskyEvents = async () => {
  try {
    const response = await blueskyApi.listEvents(authStore.getBlueskyDid)

    blueskyEvents.value = (response.data || []).filter(event => {
      return event?.value?.name && event?.value?.startsAt
    })
  } catch (err) {
    console.error('Failed to load Bluesky events:', err)
  }
}
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
                  <img :src="avatarUrl" :alt="user.firstName + ' ' + user.lastName" />
                </q-avatar>
                <h4 class="q-mt-md text-h5 text-bold q-mb-xs">
                  {{ user.firstName }} {{ user.lastName }}
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
                <img :src="avatarUrl" :alt="user.name" />
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

            <!-- Add Bluesky Events Section -->
            <q-card-section v-if="blueskyEvents?.length > 0">
              <div class="text-h6 q-mb-md">Events on Bluesky</div>
              <div class="q-gutter-y-md">
                <q-card flat bordered v-for="event in blueskyEvents" :key="event.uri" class="event-card">
                  <q-card-section>
                    <!-- Header with title and delete button -->
                    <div class="row items-center justify-between q-mb-sm">
                      <div class="text-h6">{{ event.value?.name }}</div>
                      <q-btn
                        flat
                        round
                        color="grey-6"
                        icon="delete"
                        size="sm"
                        :loading="deletingEvent === event.uri"
                        @click="confirmDelete(event)"
                      />
                    </div>

                    <!-- Event time -->
                    <div class="text-subtitle2 text-grey-8 q-mb-md">
                      {{ new Date(event.value?.startsAt).toLocaleString() }}
                    </div>

                    <!-- Description -->
                    <div v-if="event.value?.description" class="text-body1 q-mb-md">
                      {{ event.value.description }}
                    </div>

                    <!-- Info section -->
                    <div class="q-gutter-y-sm">
                      <!-- Locations -->
                      <div v-for="(loc, index) in event.value?.locations" :key="'loc-' + index">
                        <template v-if="loc.type === 'community.lexicon.location.geo'">
                          <div class="row items-center text-grey-8">
                            <q-icon name="place" size="18px" class="q-mr-sm" />
                            <span>{{ loc.description }}</span>
                          </div>
                        </template>
                      </div>

                      <!-- Links -->
                      <div v-for="(uri, index) in event.value?.uris" :key="'uri-' + index">
                        <div class="row items-center">
                          <q-icon
                            :name="uri.name === 'Event Image' ? 'image' : 'link'"
                            size="18px"
                            class="q-mr-sm text-grey-8"
                          />
                          <a
                            :href="uri.uri"
                            target="_blank"
                            class="text-primary"
                          >
                            {{ uri.name || uri.uri }}
                          </a>
                        </div>
                      </div>
                    </div>
                  </q-card-section>
                </q-card>
              </div>
            </q-card-section>

            <!-- Delete Confirmation Dialog -->
            <q-dialog v-model="showDeleteConfirm">
              <q-card>
                <q-card-section>
                  <div class="text-h6">Delete Event</div>
                </q-card-section>
                <q-card-section>
                  Are you sure you want to delete "{{ eventToDelete?.value?.name || 'this event' }}"?
                </q-card-section>
                <q-card-actions align="right">
                  <q-btn flat label="Cancel" v-close-popup />
                  <q-btn
                    flat
                    label="Delete"
                    color="negative"
                    :loading="!!deletingEvent"
                    @click="deleteEvent"
                  />
                </q-card-actions>
              </q-card>
            </q-dialog>
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
                <h6 class="q-mt-sm q-mb-none">Github User</h6>
                <h6 class="q-mt-sm q-mb-none">
                  <a :href="`https://github.com/${user.socialId}`" target="_blank" class="text-primary">
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

<style lang="scss" scoped>
.event-card {
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 8px;
  transition: box-shadow 0.2s ease;

  &:hover {
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .text-h6 {
    font-size: 1.1rem;
    line-height: 1.4;
  }

  .text-subtitle2 {
    color: rgba(0, 0, 0, 0.6);
  }

  .text-body1 {
    font-size: 0.95rem;
    line-height: 1.5;
    white-space: pre-line;
  }

  .q-icon {
    opacity: 0.7;
  }

  a {
    text-decoration: none;
    &:hover {
      text-decoration: underline;
    }
  }
}
</style>
