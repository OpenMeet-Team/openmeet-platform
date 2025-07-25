<template>
  <div class="unified-chat">
    <!-- Mobile Chat Interface with Drawer -->
    <div class="mobile-chat-container lt-sm">
      <q-layout view="lHh Lpr lFf" container class="mobile-chat-layout">
        <!-- Left Drawer - Chat List -->
        <q-drawer
          v-model="leftDrawerOpen"
          :width="280"
          bordered
          class="bg-grey-1"
          :class="{ 'dark-purple-bg': $q.dark.isActive }"
        >
          <ChatListPanel
            :context-type="contextType"
            :context-id="contextId"
            @select-chat="selectChatMobile"
          />
        </q-drawer>

        <!-- Right Drawer - Chat Info -->
        <q-drawer
          v-model="rightDrawerOpen"
          side="right"
          :width="260"
          bordered
          class="bg-grey-1"
          :class="{ 'dark-purple-bg': $q.dark.isActive }"
        >
          <ChatInfoPanel
            v-if="activeChat"
            :chat="activeChat"
            :context-type="contextType"
            :context-id="contextId"
          />
          <div v-else class="flex flex-center full-height">
            <div class="text-center">
              <q-icon name="fas fa-info-circle" size="48px" color="grey-5" />
              <div class="text-h6 q-mt-md text-grey-6">Select a chat</div>
            </div>
          </div>
        </q-drawer>

        <!-- Main Chat Area -->
        <q-page-container>
          <q-page class="chat-page">
            <!-- Mobile Chat Header -->
            <q-header class="mobile-chat-header bg-grey-2 text-dark" :class="{ 'dark-purple-bg': $q.dark.isActive }">
              <q-toolbar>
                <q-btn
                  flat
                  dense
                  round
                  icon="fas fa-bars"
                  @click="leftDrawerOpen = !leftDrawerOpen"
                  class="lt-sm"
                />

                <div v-if="activeChat" class="row items-center full-width">
                  <q-avatar size="32px" :color="getChatColor(activeChat)" text-color="white" class="q-mr-sm">
                    <q-icon :name="getChatIcon(activeChat)" />
                  </q-avatar>
                  <div class="col">
                    <div class="text-subtitle2">{{ activeChat.name }}</div>
                    <div class="text-caption">{{ getChatSubtitle(activeChat) }}</div>
                  </div>
                  <q-btn
                    flat
                    dense
                    round
                    icon="fas fa-info-circle"
                    @click="rightDrawerOpen = !rightDrawerOpen"
                  />
                </div>
                <div v-else class="text-subtitle1">Select a chat</div>
              </q-toolbar>
            </q-header>

            <!-- Chat Content with proper mobile height -->
            <div class="mobile-chat-content">
              <div v-if="activeChat" class="mobile-chat-wrapper">
                <MatrixChatInterface
                  :room-id="activeChat.matrixRoomId"
                  :context-type="activeChat.type"
                  :context-id="getContextId(activeChat)"
                  mode="mobile"
                />
              </div>
              <div v-else class="flex flex-center full-height">
                <div class="text-center">
                  <q-icon name="fas fa-comments" size="64px" color="grey-5" />
                  <div class="text-h6 q-mt-md text-grey-6">Select a chat to start messaging</div>
                  <div class="text-body2 text-grey-5">Choose from your recent conversations</div>
                </div>
              </div>
            </div>
          </q-page>
        </q-page-container>
      </q-layout>
    </div>

    <!-- Desktop Chat Interface -->
    <div class="desktop-chat-container gt-xs row no-wrap q-pa-md q-gutter-md">
      <!-- Chat List Sidebar Card -->
      <q-card
        class="chat-list-sidebar-card"
        style="width: 320px; max-height: calc(100vh - 120px);"
        flat
        bordered
      >
        <ChatListPanel
          :context-type="contextType"
          :context-id="contextId"
          @select-chat="selectChat"
        />
      </q-card>

      <!-- Active Chat Area Card -->
      <q-card
        class="chat-area-card flex column"
        style="flex: 1; max-height: calc(100vh - 120px);"
        flat
        bordered
      >
        <div v-if="activeChat" class="full-height">
          <MatrixChatInterface
            :room-id="activeChat.matrixRoomId"
            :context-type="activeChat.type"
            :context-id="getContextId(activeChat)"
            mode="desktop"
          />
        </div>
        <div v-else class="flex flex-center full-height">
          <div class="text-center">
            <q-icon name="fas fa-comments" size="64px" color="grey-5" />
            <div class="text-h6 q-mt-md text-grey-6">Select a chat to start messaging</div>
            <div class="text-body2 text-grey-5">Choose from your recent conversations</div>
          </div>
        </div>
      </q-card>

      <!-- Chat Info Sidebar Card (optional) -->
      <q-card
        v-if="activeChat && showInfoSidebar"
        class="chat-info-sidebar-card"
        style="width: 250px; max-height: calc(100vh - 120px);"
        flat
        bordered
      >
        <ChatInfoPanel
          :chat="activeChat"
          :context-type="contextType"
          :context-id="contextId"
        />
      </q-card>
    </div>

    <!-- Inline Mode (for embedding in event/group pages) -->
    <div v-if="mode === 'inline'" class="inline-chat-container">
      <div class="inline-chat-header q-pa-md bg-grey-2">
        <div class="row items-center">
          <q-icon name="fas fa-comments" class="q-mr-sm" />
          <div class="text-subtitle1">Discussion</div>
          <q-space />
          <q-btn
            v-if="canOpenFullscreen"
            icon="fullscreen"
            flat
            round
            size="sm"
            @click="openFullscreen"
          />
        </div>
      </div>
      <MatrixChatInterface
        :room-id="inlineRoomId"
        :context-type="contextType === 'all' ? 'direct' : contextType"
        :context-id="contextId"
        mode="inline"
        style="height: 400px;"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { matrixClientService } from '../../services/matrixClientService'
import ChatListPanel from './ChatListPanel.vue'
import ChatInfoPanel from './ChatInfoPanel.vue'
import MatrixChatInterface from './MatrixChatInterface.vue'

interface Chat {
  id: string
  name: string
  type: 'direct' | 'group' | 'event'
  matrixRoomId: string
  lastMessage?: string
  lastActivity?: Date
  unreadCount?: number
  participants?: Array<{ id: string; name: string; avatar?: string }>
  isEncrypted?: boolean
}

interface Props {
  // Context for filtering chats
  contextType?: 'all' | 'direct' | 'group' | 'event'
  contextId?: string

  // Display mode
  mode?: 'dashboard' | 'inline' | 'fullscreen'

  // For inline mode
  inlineRoomId?: string

  // Configuration
  canOpenFullscreen?: boolean
  showInfoSidebar?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  contextType: 'all',
  mode: 'dashboard',
  canOpenFullscreen: true,
  showInfoSidebar: false
})

// State
const leftDrawerOpen = ref(false)
const rightDrawerOpen = ref(false)
const activeChat = ref<Chat | null>(null)
const router = useRouter()
const $q = useQuasar()

// Initialize Matrix on component mount
onMounted(async () => {
  try {
    // For the main chats dashboard, we want to show available chats proactively
    // This differs from inline/event contexts where we wait for user opt-in
    if (props.mode === 'dashboard') {
      // Accessing the chats dashboard implies user consent to connect to Matrix
      console.log('💡 Setting user consent for Matrix connection (dashboard mode)')
      matrixClientService.setUserChosenToConnect(true)
      await matrixClientService.initializeClient(true)
    } else {
      // Only initialize if user has already chosen to connect to Matrix (for inline/event contexts)
      if (!matrixClientService.hasUserChosenToConnect()) {
        console.log('💭 User has not chosen to connect to Matrix - skipping initialization')
        return
      }
      await matrixClientService.initializeClient()
    }
  } catch (error) {
    console.error('Failed to initialize Matrix:', error)
  }
})

// Methods
const selectChat = (chat: Chat) => {
  activeChat.value = chat
  console.log(`🔗 Selected chat: ${chat.name} (${chat.matrixRoomId})`)

  // Update URL if in dashboard mode
  if (props.mode === 'dashboard') {
    router.push({
      name: 'DashboardChatsPage',
      query: { chat: chat.id }
    })
  }
}

const selectChatMobile = (chat: Chat) => {
  selectChat(chat)
  // On mobile, close the left drawer after selecting a chat
  if ($q.screen.lt.sm) {
    leftDrawerOpen.value = false
  }
}

const openFullscreen = () => {
  router.push({
    name: 'DashboardChatsPage',
    query: {
      chat: props.inlineRoomId,
      return: router.currentRoute.value.fullPath
    }
  })
}

const getChatColor = (chat: Chat): string => {
  switch (chat.type) {
    case 'direct': return 'blue'
    case 'group': return 'purple'
    case 'event': return 'green'
    default: return 'grey'
  }
}

const getChatIcon = (chat: Chat): string => {
  switch (chat.type) {
    case 'direct': return chat.isEncrypted ? 'fas fa-lock' : 'fas fa-user'
    case 'group': return 'groups'
    case 'event': return 'event'
    default: return 'fas fa-comments'
  }
}

const getChatSubtitle = (chat: Chat): string => {
  const prefix = chat.isEncrypted ? '🔐 ' : ''
  const count = chat.participants?.length || 0

  switch (chat.type) {
    case 'direct': return `${prefix}Direct message`
    case 'group': return `${prefix}${count} members`
    case 'event': return `${prefix}Event discussion`
    default: return prefix
  }
}

// Extract the slug from the chat ID for API calls
const getContextId = (chat: Chat): string => {
  // Chat IDs are in format: 'group-slug' or 'event-slug'
  if (chat.id.startsWith('group-')) {
    return chat.id.replace('group-', '')
  }
  if (chat.id.startsWith('event-')) {
    return chat.id.replace('event-', '')
  }
  return chat.id
}

// Load initial chat if specified in URL
onMounted(() => {
  const chatId = router.currentRoute.value.query.chat as string
  if (chatId && props.mode === 'dashboard') {
    // Load and select the specified chat
    // This would call the chat service to get the chat details
  }
})
</script>

<style scoped>
.unified-chat {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.mobile-chat-container {
  height: 100%;
  width: 100%;
}

.desktop-chat-container {
  height: 80vh;
  flex: 1;
  overflow: hidden;
}

.mobile-chat-layout {
  height: calc(100vh - 60px) !important; /* Account for system bars */
  height: calc(100dvh - 60px) !important;
  max-height: calc(100vh - 60px);
}

.chat-page {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.mobile-chat-header {
  position: sticky;
  top: 0;
  z-index: 1000;
}

.mobile-chat-content {
  height: calc(100vh - 116px); /* Header + system bars */
  height: calc(100dvh - 116px);
  max-height: calc(100vh - 116px);
  overflow: hidden;
  position: relative;
}

.mobile-chat-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
}

.inline-chat-container {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
}

.inline-chat-header {
  border-bottom: 1px solid #e0e0e0;
}

/* Desktop card-based layout */
.desktop-chat-container {
  height: calc(100vh - 80px);
}

.chat-list-sidebar-card {
  box-shadow: 0 1px 5px rgba(0, 0, 0, 0.1);
  transition: box-shadow 0.2s ease;
  overflow: hidden;
}

.chat-list-sidebar-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.chat-area-card {
  box-shadow: 0 1px 5px rgba(0, 0, 0, 0.1);
  transition: box-shadow 0.2s ease;
  overflow: hidden;
}

.chat-info-sidebar-card {
  box-shadow: 0 1px 5px rgba(0, 0, 0, 0.1);
  transition: box-shadow 0.2s ease;
  overflow: hidden;
}

.chat-info-sidebar-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

/* Dark mode card styling */
.q-dark .chat-list-sidebar-card,
.q-dark .chat-area-card,
.q-dark .chat-info-sidebar-card {
  box-shadow: 0 1px 5px rgba(255, 255, 255, 0.1);
}

.q-dark .chat-list-sidebar-card:hover,
.q-dark .chat-info-sidebar-card:hover {
  box-shadow: 0 2px 8px rgba(255, 255, 255, 0.15);
}

/* Dark background for sidebars in dark mode using OpenMeet palette */
.dark-purple-bg {
  background-color: #1E1A43 !important; /* $purple-600 from OpenMeet palette */
  color: white !important; /* Ensure text is white on dark background */
}

@media (max-width: 599px) {
  .mobile-chat-list,
  .mobile-active-chat,
  .mobile-chat-info {
    height: calc(100vh - 140px);
  }
}
</style>
