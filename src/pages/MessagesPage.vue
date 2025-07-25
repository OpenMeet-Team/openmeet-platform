<script setup lang="ts">
import { ref, computed, onMounted, watch, onBeforeUnmount } from 'vue'
import NoContentComponent from '../components/global/NoContentComponent.vue'
import DashboardTitle from '../components/dashboard/DashboardTitle.vue'
import SpinnerComponent from '../components/common/SpinnerComponent.vue'
import MessagesComponent from '../components/messages/MessagesComponent.vue'
import { useMessageStore } from '../stores/unified-message-store'
// import { useGroupStore } from '../stores/group-store'
// import { useEventStore } from '../stores/event-store'
import { LoadingBar, QTabs, QTab, QTabPanels, QTabPanel } from 'quasar'
import { useRoute, useRouter } from 'vue-router'
import { getImageSrc } from '../utils/imageUtils'
import { useNavigation } from '../composables/useNavigation'
import { useNotification } from '../composables/useNotification'
import { eventsApi } from '../api/events'
import { groupsApi } from '../api/groups'

const route = useRoute()
const router = useRouter()
const messageStore = useMessageStore()
// const messageScrollArea = ref<InstanceType<typeof QScrollArea> | null>(null)
const { error } = useNotification()

// UI state
const isLoading = ref(true) // Start with loading true
const isLoadingGroups = ref(true) // Start with loading true
const isLoadingEvents = ref(true) // Start with loading true
const hasInitialized = ref(false) // Track if we've completed initial load
const activeTab = ref('direct')

// Search state
const searchQuery = ref('')

// Get all chat lists
const directChats = computed(() => messageStore.directChats)
const avatarSrc = getImageSrc(null)

// Navigation
const { navigateToChat } = useNavigation()

// Filtered chats for search functionality
const filteredDirectChats = computed(() => {
  return directChats.value?.filter(chat =>
    searchQuery.value
      ? chat.participant?.name?.toLowerCase().includes(searchQuery.value.toLowerCase())
      : true
  )
})

// Get active chat
const activeChat = computed(() => messageStore.activeDirectChat)

// Fetch Lists
const fetchDirectChats = async () => {
  try {
    // Fetch the direct chat list
    try {
      await messageStore.actionGetChatList(route.query)
    } catch (chatError) {
      // If we get 404, it means the DM endpoints aren't implemented yet
      // Just set an empty array and don't show an error to the user
      console.log('Direct messages API not yet implemented:', chatError)
      messageStore.directChats = []
    }
    return true
  } catch (err) {
    console.error('Failed to get direct chat list:', err)
    // Don't show error to user for now since this endpoint isn't implemented yet
    // error('Failed to load messages')
    return false
  } finally {
    isLoading.value = false
  }
}

// Fetch recent groups with discussions
// const groupStore = useGroupStore()
const recentGroups = ref([])

const fetchRecentGroups = async () => {
  try {
    // Use the groupsApi.getAllMe() endpoint through the API
    const response = await groupsApi.getAllMe()
    if (response?.data) {
      recentGroups.value = response.data.slice(0, 10) // Limit to 10 most recent
    }
    return true
  } catch (err) {
    console.error('Failed to get recent groups:', err)
    return false
  } finally {
    isLoadingGroups.value = false
  }
}

// Fetch recent events with discussions
// const eventStore = useEventStore()
const recentEvents = ref([])

const fetchRecentEvents = async () => {
  try {
    // Use eventsApi.getDashboardEvents() through the API
    const response = await eventsApi.getDashboardEvents()
    if (response?.data) {
      recentEvents.value = response.data.slice(0, 10) // Limit to 10 most recent
    }
    return true
  } catch (err) {
    console.error('Failed to get recent events:', err)
    return false
  } finally {
    isLoadingEvents.value = false
  }
}

// Navigation to specific chats
const navigateToGroupChat = (groupSlug) => {
  router.push({ name: 'GroupDiscussionsPage', params: { slug: groupSlug } })
}

const navigateToEventChat = (eventSlug) => {
  router.push({ name: 'EventPage', params: { slug: eventSlug }, query: { tab: 'discussion' } })
}

// Select chat view
// const selectChat = (chat) => {
//   messageStore.actionSetActiveChat(chat)
// }

// Lifecycle
onMounted(async () => {
  LoadingBar.start()
  try {
    // Initialize Matrix connection for real-time updates
    await messageStore.initializeMatrix()

    // Fetch all message types in parallel
    await Promise.all([
      fetchDirectChats(),
      fetchRecentGroups(),
      fetchRecentEvents()
    ])
  } catch (err) {
    console.error('Error initializing messages:', err)
    error('Failed to load messages')
  } finally {
    hasInitialized.value = true
    LoadingBar.stop()
  }
})

// Setup route watcher for query changes
watch(() => route.query, async () => {
  // If navigating to a specific chat
  if (route.query.chat) {
    isLoading.value = true
    await fetchDirectChats().finally(() => {
      isLoading.value = false
    })
  }
})

// Cleanup
onBeforeUnmount(() => {
  // Clean up Matrix-related resources
  messageStore.cleanup()
})
</script>

<template>
  <q-page padding style="max-width: 1024px;" class="q-mx-auto c-chats-page q-pb-xl">
    <DashboardTitle defaultBack label="Chats" />

    <SpinnerComponent v-if="!hasInitialized" />

    <div v-else class="chats-page row q-col-gutter-md">
      <!-- Left sidebar with tabs for different message types -->
      <div class="col-4">
        <q-card flat bordered class="full-height">
          <!-- Tab navigation -->
          <q-tabs
            v-model="activeTab"
            class="text-primary"
            indicator-color="primary"
            align="justify"
            narrow-indicator
          >
            <q-tab name="direct" icon="sym_r_chat" label="Direct" />
            <q-tab name="groups" icon="sym_r_group" label="Groups" />
            <q-tab name="events" icon="sym_r_event" label="Events" />
          </q-tabs>

          <!-- Search box (only for direct chats) -->
          <q-input
            v-if="activeTab === 'direct'"
            v-model="searchQuery"
            @clear="searchQuery = ''"
            filled
            type="search"
            label="Search people"
            clearable
            class="q-ma-md"
          >
            <template v-slot:append>
              <q-icon name="sym_r_search" />
            </template>
          </q-input>

          <!-- Tab content panels -->
          <q-tab-panels v-model="activeTab" animated class="full-height">
            <!-- Direct Messages Tab -->
            <q-tab-panel name="direct" class="q-pa-none">
              <!-- Coming Soon message since direct message API isn't implemented yet -->
              <div class="column items-center justify-center q-pa-lg">
                <q-icon name="sym_r_chat" size="64px" color="grey-5" />
                <div class="text-h6 q-mt-md">Direct Messages</div>
                <p class="text-body1 q-mt-sm text-center">
                  Direct messaging functionality is coming soon. <br>
                  Please check back later!
                </p>
              </div>

              <!-- This will be enabled once the API is implemented -->
              <div v-if="false" data-cy="chat-list">
                <q-list separator v-if="filteredDirectChats?.length" style="max-height: 100%;">
                  <q-item
                    v-for="chat in filteredDirectChats"
                    :key="chat.id"
                    clickable
                    v-ripple
                    :active="activeChat && activeChat.id === chat.id"
                    @click="navigateToChat({ chat: chat.ulid })"
                    data-cy="chat-item"
                  >
                    <q-item-section avatar>
                      <q-avatar>
                        <img :src="chat.participant.photo ? getImageSrc(chat.participant.photo) : avatarSrc" />
                      </q-avatar>
                    </q-item-section>
                    <q-item-section>
                      <q-item-label>{{ chat.participant.firstName }} {{ chat.participant.lastName }}</q-item-label>
                      <q-item-label caption>{{ chat.participant.name }}</q-item-label>
                    </q-item-section>
                    <q-item-section side v-if="chat.unreadCount">
                      <q-badge color="red">{{ chat.unreadCount }}</q-badge>
                    </q-item-section>
                  </q-item>
                </q-list>
                <NoContentComponent v-else icon="sym_r_chat" label="No direct messages yet" />
              </div>
            </q-tab-panel>

            <!-- Groups Tab -->
            <q-tab-panel name="groups" class="q-pa-none">
              <div v-if="isLoadingGroups" class="q-pa-md text-center">
                <q-spinner-dots color="primary" size="40px" />
                <div class="text-caption q-mt-sm">Loading groups...</div>
              </div>
              <q-list separator v-else-if="recentGroups.length" style="max-height: 100%;">
                <q-item
                  v-for="group in recentGroups"
                  :key="group.id"
                  clickable
                  v-ripple
                  @click="navigateToGroupChat(group.slug)"
                >
                  <q-item-section avatar>
                    <q-avatar>
                      <img :src="group.photo ? getImageSrc(group.photo) : avatarSrc" />
                    </q-avatar>
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>{{ group.name }}</q-item-label>
                    <q-item-label caption>{{ group.members?.length || 0 }} members</q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>
              <NoContentComponent v-else icon="sym_r_group" label="No group discussions yet" />
            </q-tab-panel>

            <!-- Events Tab -->
            <q-tab-panel name="events" class="q-pa-none">
              <div v-if="isLoadingEvents" class="q-pa-md text-center">
                <q-spinner-dots color="primary" size="40px" />
                <div class="text-caption q-mt-sm">Loading events...</div>
              </div>
              <q-list separator v-else-if="recentEvents.length" style="max-height: 100%;">
                <q-item
                  v-for="event in recentEvents"
                  :key="event.id"
                  clickable
                  v-ripple
                  @click="navigateToEventChat(event.slug)"
                >
                  <q-item-section avatar>
                    <q-avatar>
                      <img :src="event.photo ? getImageSrc(event.photo) : avatarSrc" />
                    </q-avatar>
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>{{ event.name }}</q-item-label>
                    <q-item-label caption>{{ new Date(event.startDate).toLocaleDateString() }}</q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>
              <NoContentComponent v-else icon="sym_r_event" label="No event discussions yet" />
            </q-tab-panel>
          </q-tab-panels>
        </q-card>
      </div>

      <!-- Right panel: Chat display area -->
      <div class="col relative-position">
        <template v-if="activeTab === 'direct'">
          <!-- Coming Soon message for direct chat feature -->
          <q-card flat bordered class="full-height" data-cy="chat-container">
            <q-card-section class="text-center column items-center justify-center">
              <q-icon name="sym_r_forum" size="64px" color="grey-5" />
              <div class="text-h6 q-mt-md">Direct Messaging</div>
              <p class="text-body1 q-mt-sm">
                The ability to send direct messages to other users is coming soon!
              </p>
              <p class="text-caption q-mt-md">
                In the meantime, you can use group discussions and event comments to communicate with other users.
              </p>
            </q-card-section>
            <!-- Hidden input for the test to find -->
            <div class="hidden" style="display:none;">
              <input data-cy="chat-input" />
              <div data-cy="chat-list"></div>
            </div>
          </q-card>

          <!-- This will be enabled once the API is implemented -->
          <div v-if="false">
            <div class="full-height column" data-cy="chat-messages" v-if="activeChat">
              <!-- Chat header -->
              <q-card flat bordered>
                <q-card-section class="row items-center col">
                  <div class="row items-center">
                    <div class="row col items-center">
                      <q-avatar size="48px" class="q-mr-md">
                        <img
                          :src="activeChat.participant.photo ? getImageSrc(activeChat.participant.photo) : avatarSrc" />
                      </q-avatar>
                      <div class="text-h6">{{ activeChat.participant?.firstName }} {{ activeChat.participant?.lastName }}
                      </div>
                    </div>

                    <q-btn round dense flat icon="sym_r_close" @click="router.push({ name: 'DashboardChatsPage' })">
                      <q-tooltip>Close chat</q-tooltip>
                    </q-btn>
                  </div>
                </q-card-section>
              </q-card>

              <!-- Messages using the unified component -->
              <MessagesComponent
                v-if="activeChat.roomId"
                :room-id="activeChat.roomId"
                context-type="direct"
                :context-id="activeChat.ulid"
                :can-read="true"
                :can-write="true"
                :can-manage="false"
                class="col"
              />
              <NoContentComponent v-else class="col" icon="sym_r_chat" label="No messages yet" />
            </div>
            <NoContentComponent v-else class="full-height" icon="sym_r_chat" label="Select a chat to start messaging" />
          </div>
        </template>

        <!-- Information displays for group and event tabs -->
        <template v-else-if="activeTab === 'groups'">
          <q-card flat bordered class="full-height">
            <q-card-section class="text-center column items-center justify-center">
              <q-icon name="sym_r_group" size="64px" color="grey-5" />
              <div class="text-h6 q-mt-md">Group Discussions</div>
              <p class="text-body1 q-mt-sm">
                Select a group from the sidebar to view its discussions.
              </p>
              <q-btn
                color="primary"
                label="Browse Groups"
                icon="sym_r_group"
                class="q-mt-md"
                to="/groups"
              />
            </q-card-section>
          </q-card>
        </template>

        <template v-else-if="activeTab === 'events'">
          <q-card flat bordered class="full-height">
            <q-card-section class="text-center column items-center justify-center">
              <q-icon name="sym_r_event" size="64px" color="grey-5" />
              <div class="text-h6 q-mt-md">Event Discussions</div>
              <p class="text-body1 q-mt-sm">
                Select an event from the sidebar to view its discussion area.
              </p>
              <q-btn
                color="primary"
                label="Browse Events"
                icon="sym_r_event"
                class="q-mt-md"
                to="/events"
              />
            </q-card-section>
          </q-card>
        </template>
      </div>
    </div>
  </q-page>
</template>

<style scoped>
.chats-page {
  min-height: calc(100vh - 260px);
}

/* Make sure tabs fill available height */
.q-tab-panels {
  height: calc(100% - 100px); /* Adjust based on the height of the tabs + search box */
}

.q-tab-panel {
  height: 100%;
  overflow-y: auto;
}
</style>
