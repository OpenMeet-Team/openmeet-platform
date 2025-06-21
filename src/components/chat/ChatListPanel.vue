<template>
  <div class="chat-list-panel">
    <!-- Header with search and filters -->
    <div class="chat-list-header q-pa-md">
      <div class="text-subtitle1 q-mb-md">
        {{ getHeaderTitle() }}
        <q-spinner v-if="isLoadingRooms" size="16px" class="q-ml-sm" />
        <q-badge v-else-if="realRooms.length > 0" color="green" class="q-ml-sm">{{ realRooms.length }}</q-badge>
        <q-badge v-else color="orange" class="q-ml-sm">demo</q-badge>
      </div>

      <!-- Search -->
      <q-input
        v-model="searchTerm"
        placeholder="Search chats..."
        dense
        outlined
        class="q-mb-sm"
      >
        <template v-slot:prepend>
          <q-icon name="fas fa-search" />
        </template>
        <template v-slot:append>
          <q-btn
            v-if="searchTerm"
            icon="clear"
            flat
            round
            dense
            @click="searchTerm = ''"
          />
        </template>
      </q-input>

      <!-- Filters for 'all' context -->
      <div v-if="contextType === 'all'" class="chat-filters">
        <q-btn-toggle
          v-model="chatFilter"
          :options="[
            { label: 'All', value: 'all' },
            { label: 'Direct', value: 'direct' },
            { label: 'Groups', value: 'group' },
            { label: 'Events', value: 'event' }
          ]"
          color="primary"
          size="sm"
          dense
          class="full-width"
        />
      </div>
    </div>

    <!-- Chat List -->
    <div class="chat-list q-pa-sm">
      <q-list>
        <!-- Recent Chats Section -->
        <q-item-label header v-if="recentChats.length > 0">
          Recent
        </q-item-label>

        <q-item
          v-for="chat in filteredRecentChats"
          :key="chat.id"
          clickable
          @click="$emit('select-chat', chat)"
          :class="{ 'bg-blue-1': selectedChatId === chat.id }"
          class="chat-item"
        >
          <q-item-section avatar>
            <q-badge
              v-if="chat.unreadCount && chat.unreadCount > 0"
              :label="chat.unreadCount"
              color="red"
              floating
            >
              <q-avatar size="40px" :color="getChatColor(chat)" text-color="white">
                <q-icon :name="getChatIcon(chat)" />
              </q-avatar>
            </q-badge>
            <q-avatar v-else size="40px" :color="getChatColor(chat)" text-color="white">
              <q-icon :name="getChatIcon(chat)" />
            </q-avatar>
          </q-item-section>

          <q-item-section>
            <q-item-label lines="1" class="text-weight-medium">
              {{ chat.name }}
            </q-item-label>
            <q-item-label caption lines="1">
              {{ chat.lastMessage || getChatSubtitle(chat) }}
            </q-item-label>
          </q-item-section>

          <q-item-section side>
            <div class="column items-end">
              <div v-if="chat.lastActivity" class="text-caption text-grey-6">
                {{ formatTime(chat.lastActivity) }}
              </div>
              <q-icon
                v-if="chat.isEncrypted"
                name="fas fa-lock"
                size="12px"
                color="green"
                class="q-mt-xs"
              />
            </div>
          </q-item-section>
        </q-item>

        <!-- Available Chats Section -->
        <q-item-label header v-if="availableChats.length > 0" class="q-mt-md">
          Available
        </q-item-label>

        <q-item
          v-for="chat in filteredAvailableChats"
          :key="chat.id"
          clickable
          @click="joinChat(chat)"
          class="chat-item available-chat"
        >
          <q-item-section avatar>
            <q-avatar size="40px" :color="getChatColor(chat)" text-color="white">
              <q-icon :name="getChatIcon(chat)" />
            </q-avatar>
          </q-item-section>

          <q-item-section>
            <q-item-label lines="1" class="text-weight-medium">
              {{ chat.name }}
            </q-item-label>
            <q-item-label caption lines="1">
              {{ getChatSubtitle(chat) }}
            </q-item-label>
          </q-item-section>

          <q-item-section side>
            <q-btn
              icon="fas fa-plus"
              size="sm"
              round
              flat
              color="primary"
              @click.stop="joinChat(chat)"
            />
          </q-item-section>
        </q-item>

        <!-- Empty State -->
        <div v-if="filteredRecentChats.length === 0 && filteredAvailableChats.length === 0" class="empty-state q-pa-lg text-center">
          <q-icon :name="getEmptyIcon()" size="48px" color="grey-5" />
          <div class="text-h6 q-mt-md text-grey-6">{{ getEmptyTitle() }}</div>
          <div class="text-body2 text-grey-5">{{ getEmptySubtitle() }}</div>

          <!-- Action buttons for different contexts -->
          <div v-if="contextType === 'all'" class="q-mt-md">
            <q-btn
              label="Start Direct Message"
              color="primary"
              outline
              @click="startDirectMessage"
              class="q-mb-sm"
            />
            <br>
            <q-btn
              label="Browse Groups"
              color="purple"
              outline
              @click="browseGroups"
            />
          </div>
        </div>
      </q-list>
    </div>

    <!-- Floating Action Button for mobile -->
    <q-page-sticky position="bottom-right" :offset="[18, 18]" class="gt-xs-hide">
      <q-btn
        fab
        icon="fas fa-plus"
        color="primary"
        @click="showNewChatDialog = true"
      />
    </q-page-sticky>

    <!-- New Chat Dialog -->
    <q-dialog v-model="showNewChatDialog">
      <q-card style="min-width: 350px">
        <q-card-section>
          <div class="text-h6">Start New Chat</div>
        </q-card-section>

        <q-card-section>
          <q-btn-toggle
            v-model="newChatType"
            :options="[
              { label: 'Direct Message', value: 'direct', icon: 'fas fa-user' },
              { label: 'Find Group', value: 'group', icon: 'groups' },
              { label: 'Find Event', value: 'event', icon: 'event' }
            ]"
            color="primary"
            class="full-width q-mb-md"
          />

          <q-input
            v-model="newChatSearch"
            :placeholder="getNewChatPlaceholder()"
            dense
            outlined
            autofocus
            @keyup.enter="searchNewChat"
          >
            <template v-slot:append>
              <q-btn
                icon="search"
                flat
                round
                dense
                @click="searchNewChat"
                :loading="isSearching"
              />
            </template>
          </q-input>

          <!-- Search Results -->
          <q-list v-if="newChatResults.length > 0" class="q-mt-md">
            <q-item
              v-for="result in newChatResults"
              :key="result.id"
              clickable
              @click="startNewChat(result)"
            >
              <q-item-section avatar>
                <q-avatar size="32px" :color="getChatColor(result)" text-color="white">
                  <q-icon :name="getChatIcon(result)" />
                </q-avatar>
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ result.name }}</q-item-label>
                <q-item-label caption>{{ result.description }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { matrixClientService } from '../../services/matrixClientService'
import { groupsApi } from '../../api/groups'
import { eventsApi } from '../../api/events'
import { formatDistanceToNow } from 'date-fns'
import type { GroupEntity, EventEntity } from '../../types'

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
  description?: string
}

interface Props {
  contextType: 'all' | 'direct' | 'group' | 'event'
  contextId?: string
  selectedChatId?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'select-chat': [chat: Chat]
}>()

// State
const searchTerm = ref('')
const chatFilter = ref('all')
const showNewChatDialog = ref(false)
const newChatType = ref('direct')
const newChatSearch = ref('')
const newChatResults = ref<Chat[]>([])
const isSearching = ref(false)

const router = useRouter()
// Use Matrix client service directly

// Real Matrix rooms state
const realRooms = ref<Chat[]>([])
const isLoadingRooms = ref(false)

// Load real OpenMeet groups and events
const loadRealRooms = async () => {
  isLoadingRooms.value = true
  try {
    console.log('🔄 Loading user\'s joined groups and events...')

    // Get user's joined groups and events from OpenMeet APIs
    const [groupsResponse, eventsResponse] = await Promise.all([
      groupsApi.getAllMe(), // User's joined groups
      eventsApi.getDashboardEvents() // User's events
    ])

    const groups = groupsResponse.data
    const events = eventsResponse.data

    console.log('📋 Found', groups.length, 'groups and', events.length, 'events')

    // Convert groups to chat format - only include groups that have Matrix rooms
    const groupChats: Chat[] = groups
      .filter((group: GroupEntity) => group.roomId) // Only groups with actual Matrix rooms
      .map((group: GroupEntity) => ({
        id: `group-${group.slug}`,
        name: group.name,
        type: 'group' as const,
        matrixRoomId: group.roomId!, // We know it exists due to filter
        lastMessage: undefined,
        lastActivity: undefined, // Will be populated from Matrix data
        unreadCount: undefined,
        participants: [],
        isEncrypted: false,
        description: group.description
      }))

    // Convert events to chat format - only include events that have Matrix rooms
    const eventChats: Chat[] = events
      .filter((event: EventEntity) => event.roomId) // Only events with actual Matrix rooms
      .map((event: EventEntity) => ({
        id: `event-${event.slug}`,
        name: event.name,
        type: 'event' as const,
        matrixRoomId: event.roomId!, // We know it exists due to filter
        lastMessage: undefined,
        lastActivity: undefined, // Will be populated from Matrix data
        unreadCount: undefined,
        participants: [],
        isEncrypted: false,
        description: event.description
      }))

    // Combine all chats
    realRooms.value = [...groupChats, ...eventChats]

    console.log('🏠 Loaded', realRooms.value.length, 'real OpenMeet chats:')
    realRooms.value.forEach((room, index) => {
      console.log(`  ${index + 1}. ${room.name} (${room.type})`)
    })
  } catch (error) {
    console.error('❌ Failed to load real OpenMeet chats:', error)
    console.error('   Error details:', error.message)
    console.warn('⚠️ Will show mock data as fallback')
    // Keep mock data as fallback
  } finally {
    isLoadingRooms.value = false
  }
}

// Initialize Matrix and load chats on component mount
onMounted(async () => {
  try {
    console.log('🚀 ChatListPanel mounted, initializing Matrix...')
    await matrixClientService.initializeClient()
    console.log('✅ Message store Matrix initialized')

    await loadRealRooms()
  } catch (error) {
    console.error('❌ Failed to load chats:', error)
    console.error('   Will fall back to mock data')
  }
})

// Mock data for fallback only
const mockRecentChats = ref<Chat[]>([
  {
    id: 'direct-1',
    name: 'John Doe',
    type: 'direct',
    matrixRoomId: '!abc123:matrix.openmeet.net',
    lastMessage: 'Hey, how are you?',
    lastActivity: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
    unreadCount: 2,
    isEncrypted: true
  },
  {
    id: 'group-1',
    name: 'Tech Meetup Group',
    type: 'group',
    matrixRoomId: '!def456:matrix.openmeet.net',
    lastMessage: 'Looking forward to the next event!',
    lastActivity: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
    participants: [{ id: '1', name: 'John' }, { id: '2', name: 'Jane' }],
    isEncrypted: false
  }
])

const mockAvailableChats = ref<Chat[]>([
  {
    id: 'event-1',
    name: 'JavaScript Workshop',
    type: 'event',
    matrixRoomId: '!ghi789:matrix.openmeet.net',
    description: 'Learn modern JavaScript techniques',
    isEncrypted: false
  }
])

// Get recent chats (prefer real data over mock)
const recentChats = computed(() => {
  // Use real Matrix rooms if available
  if (realRooms.value.length > 0) {
    return realRooms.value.filter(chat =>
      chat.lastActivity &&
      (Date.now() - chat.lastActivity.getTime()) < 7 * 24 * 60 * 60 * 1000 // Last 7 days
    ).sort((a, b) =>
      (b.lastActivity?.getTime() || 0) - (a.lastActivity?.getTime() || 0)
    )
  }

  // Fall back to mock data
  return mockRecentChats.value
})

// Get available chats (prefer real data over mock)
const availableChats = computed(() => {
  // Use real Matrix rooms if available
  if (realRooms.value.length > 0) {
    return realRooms.value.filter(chat =>
      !chat.lastActivity ||
      (Date.now() - chat.lastActivity.getTime()) >= 7 * 24 * 60 * 60 * 1000
    ).sort((a, b) => a.name.localeCompare(b.name))
  }

  // Fall back to mock data
  return mockAvailableChats.value
})

// Computed filters - now using real data when available
const filteredRecentChats = computed(() => {
  return recentChats.value.filter(chat => {
    const matchesSearch = !searchTerm.value ||
      chat.name.toLowerCase().includes(searchTerm.value.toLowerCase()) ||
      (chat.lastMessage && chat.lastMessage.toLowerCase().includes(searchTerm.value.toLowerCase()))

    const matchesFilter = chatFilter.value === 'all' || chat.type === chatFilter.value
    const matchesContext = props.contextType === 'all' || chat.type === props.contextType

    return matchesSearch && matchesFilter && matchesContext
  })
})

const filteredAvailableChats = computed(() => {
  return availableChats.value.filter(chat => {
    const matchesSearch = !searchTerm.value ||
      chat.name.toLowerCase().includes(searchTerm.value.toLowerCase())

    const matchesFilter = chatFilter.value === 'all' || chat.type === chatFilter.value
    const matchesContext = props.contextType === 'all' || chat.type === props.contextType

    return matchesSearch && matchesFilter && matchesContext
  })
})

// Methods
const getHeaderTitle = (): string => {
  switch (props.contextType) {
    case 'direct': return 'Direct Messages'
    case 'group': return 'Group Discussions'
    case 'event': return 'Event Discussions'
    default: return 'All Chats'
  }
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
  const count = chat.participants?.length || 0

  switch (chat.type) {
    case 'direct': return 'Direct message'
    case 'group': return `${count} members`
    case 'event': return 'Event discussion'
    default: return ''
  }
}

const formatTime = (date: Date): string => {
  return formatDistanceToNow(date, { addSuffix: true })
}

const getEmptyIcon = (): string => {
  switch (props.contextType) {
    case 'direct': return 'fas fa-user'
    case 'group': return 'groups'
    case 'event': return 'event'
    default: return 'fas fa-comments'
  }
}

const getEmptyTitle = (): string => {
  switch (props.contextType) {
    case 'direct': return 'No direct messages'
    case 'group': return 'No group discussions'
    case 'event': return 'No event discussions'
    default: return 'No chats'
  }
}

const getEmptySubtitle = (): string => {
  switch (props.contextType) {
    case 'direct': return 'Start a conversation with someone'
    case 'group': return 'Join a group to start chatting'
    case 'event': return 'Join an event to participate in discussions'
    default: return 'Start a new conversation or join a group'
  }
}

const getNewChatPlaceholder = (): string => {
  switch (newChatType.value) {
    case 'direct': return 'Search for a person...'
    case 'group': return 'Search for a group...'
    case 'event': return 'Search for an event...'
    default: return 'Search...'
  }
}

const joinChat = async (chat: Chat) => {
  // Call API to join the chat/room
  // Then emit the select event
  emit('select-chat', chat)
}

const startDirectMessage = () => {
  showNewChatDialog.value = true
  newChatType.value = 'direct'
}

const browseGroups = () => {
  router.push('/groups')
}

const searchNewChat = async () => {
  if (!newChatSearch.value.trim()) return

  isSearching.value = true
  try {
    // Call appropriate API based on newChatType
    // Mock results for now
    newChatResults.value = [
      {
        id: 'search-1',
        name: newChatSearch.value,
        type: newChatType.value as 'direct' | 'group' | 'event',
        matrixRoomId: '',
        description: `Search result for ${newChatSearch.value}`
      }
    ]
  } finally {
    isSearching.value = false
  }
}

const startNewChat = async (result: Chat) => {
  // Create or join the chat based on the search result
  showNewChatDialog.value = false
  newChatSearch.value = ''
  newChatResults.value = []

  // Add to recent chats and select
  recentChats.value.unshift(result)
  emit('select-chat', result)
}

// Load chats on mount
onMounted(async () => {
  // Load chats based on context
  // await chatStore.loadChats(props.contextType, props.contextId)
})
</script>

<style scoped>
.chat-list-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.chat-list {
  flex: 1;
  overflow-y: auto;
}

.chat-item {
  margin-bottom: 4px;
  border-radius: 8px;
}

.chat-item:hover {
  background-color: rgba(0, 0, 0, 0.04);
}

.available-chat {
  opacity: 0.8;
}

.available-chat:hover {
  opacity: 1;
}

.empty-state {
  margin-top: 40px;
}

.chat-filters {
  margin-bottom: 8px;
}
</style>
