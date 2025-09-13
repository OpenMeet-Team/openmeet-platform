<template>
  <div class="chat-list-panel">
    <!-- Header with search and filters -->
    <div class="chat-list-header q-pa-md">
      <div class="text-subtitle1 q-mb-md">
        {{ getHeaderTitle() }}
        <q-spinner v-if="isMatrixInitializing || isLoadingRooms" size="16px" class="q-ml-sm" />
        <q-badge v-else-if="realRooms.length > 0" color="green" class="q-ml-sm">{{ realRooms.length }}</q-badge>
        <q-badge v-else color="orange" class="q-ml-sm">0</q-badge>
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
          <q-icon name="sym_r_search" />
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
      <div v-if="contextType === 'all'" class="chat-filters q-mb-sm">
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

      <!-- Enhanced controls row -->
      <div class="row q-gutter-xs">
        <!-- Sort options -->
        <q-select
          v-model="sortBy"
          :options="[
            { label: 'Recent Activity', value: 'activity' },
            { label: 'Name (A-Z)', value: 'name' },
            { label: 'Unread First', value: 'unread' },
            { label: 'Type', value: 'type' }
          ]"
          option-label="label"
          option-value="value"
          emit-value
          map-options
          dense
          outlined
          style="min-width: 120px;"
          label="Sort by"
          class="col"
        />

        <!-- Show only unread toggle -->
        <q-btn
          :color="showUnreadOnly ? 'primary' : 'grey-5'"
          :outline="!showUnreadOnly"
          :unelevated="showUnreadOnly"
          icon="sym_r_notifications"
          size="sm"
          @click="showUnreadOnly = !showUnreadOnly"
          class="q-px-sm"
        >
          <q-tooltip>{{ showUnreadOnly ? 'Show all chats' : 'Show only unread' }}</q-tooltip>
        </q-btn>

        <!-- Settings menu -->
        <q-btn
          color="grey-5"
          outline
          icon="sym_r_settings"
          size="sm"
          class="q-px-sm"
        >
          <q-menu>
            <q-list style="min-width: 150px">
              <q-item clickable @click="refreshRooms">
                <q-item-section avatar>
                  <q-icon name="sym_r_refresh" />
                </q-item-section>
                <q-item-section>Refresh</q-item-section>
              </q-item>
              <q-item clickable @click="markAllRead">
                <q-item-section avatar>
                  <q-icon name="sym_r_done_all" />
                </q-item-section>
                <q-item-section>Mark All Read</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>
      </div>
    </div>

    <!-- Chat List -->
    <div class="chat-list q-pa-sm">

      <!-- Recent Chats Section -->
      <div v-if="recentChats.length > 0" class="text-subtitle2 text-grey-7 q-pa-sm q-pb-xs">
        Recent
      </div>

      <div class="chat-items-container">
        <q-card
          v-for="chat in filteredRecentChats"
          :key="chat.id"
          clickable
          @click="$emit('select-chat', chat)"
          :class="{ 'selected-chat': selectedChatId === chat.id }"
          class="chat-item-card q-mb-xs"
          :data-chat-id="chat.id"
          :data-matrix-room-id="chat.matrixRoomId"
          flat
          bordered
        >
          <q-item class="q-pa-sm">
            <q-item-section avatar>
              <div class="relative-position">
                <q-avatar size="40px" :color="getChatColor(chat)" text-color="white">
                  <q-icon :name="getChatIcon(chat)" />
                </q-avatar>
                <q-badge
                  v-if="chat.unreadCount && chat.unreadCount > 0"
                  :label="chat.unreadCount > 99 ? '99+' : chat.unreadCount"
                  color="red"
                  rounded
                  class="absolute-top-right"
                  style="transform: translate(25%, -25%); min-width: 18px; font-size: 10px;"
                />
              </div>
            </q-item-section>

          <q-item-section>
            <q-item-label lines="1" class="text-weight-medium">
              {{ chat.name }}
            </q-item-label>
            <q-item-label caption class="row items-center q-gutter-xs">
              <span v-if="chat.lastActivity" class="text-grey-6">
                {{ formatTime(chat.lastActivity) }}
              </span>
              <q-icon
                v-if="chat.isEncrypted"
                name="sym_r_lock"
                size="12px"
                color="green"
              />
            </q-item-label>
          </q-item-section>
          </q-item>
        </q-card>
      </div>

      <!-- Available Chats Section -->
      <div v-if="availableChats.length > 0" class="text-subtitle2 text-grey-7 q-pa-sm q-pb-xs q-mt-md">
        Available
      </div>

      <div class="available-chat-items-container">
        <q-card
          v-for="chat in filteredAvailableChats"
          :key="chat.id"
          clickable
          @click="joinChat(chat)"
          class="chat-item-card available-chat-card q-mb-xs"
          :data-chat-id="chat.id"
          :data-matrix-room-id="chat.matrixRoomId"
          flat
          bordered
        >
          <q-item class="q-pa-sm">
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
              icon="sym_r_add"
              size="sm"
              round
              flat
              color="primary"
              @click.stop="joinChat(chat)"
            />
          </q-item-section>
          </q-item>
        </q-card>
      </div>

      <!-- Loading State -->
      <div v-if="(isMatrixInitializing || isLoadingRooms) && realRooms.length === 0" class="loading-state q-pa-lg text-center">
        <q-spinner-dots color="primary" size="40px" />
        <div class="text-h6 q-mt-md text-grey-6">Loading chats...</div>
        <div class="text-body2 text-grey-5">Connecting to Matrix and syncing rooms</div>
      </div>

      <!-- Empty State -->
      <div v-else-if="filteredRecentChats.length === 0 && filteredAvailableChats.length === 0" class="empty-state q-pa-lg text-center">
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
    </div>

    <!-- Floating Action Button for mobile -->
    <q-page-sticky position="bottom-right" :offset="[18, 18]" class="gt-xs-hide" style="z-index: 2000;">
      <q-btn
        fab
        icon="sym_r_add"
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
              { label: 'Direct Message', value: 'direct', icon: 'sym_r_person' },
              { label: 'Find Group', value: 'group', icon: 'sym_r_group' },
              { label: 'Find Event', value: 'event', icon: 'sym_r_event' }
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
import { matrixClientManager } from '../../services/MatrixClientManager'
import { groupsApi } from '../../api/groups'
import { eventsApi } from '../../api/events'
import { searchApi } from '../../api/search'
import { usersApi } from '../../api/users'
import { formatDistanceToNow } from 'date-fns'
import { Room, RoomMember, ClientEvent, RoomEvent, MatrixEvent } from 'matrix-js-sdk'
import type { GroupEntity, EventEntity } from '../../types'
import { logger } from '../../utils/logger'

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
const sortBy = ref('activity')
const showUnreadOnly = ref(false)
const showNewChatDialog = ref(false)
const newChatType = ref('direct')
const newChatSearch = ref('')
const newChatResults = ref<Chat[]>([])
const isSearching = ref(false)

const router = useRouter()
// Use Matrix client service directly

const realRooms = ref<Chat[]>([])
const isLoadingRooms = ref(true) // Start with loading true
const isMatrixInitializing = ref(true)

// Load ALL Matrix rooms that user has joined, then identify which are OpenMeet rooms
const loadRealRooms = async () => {
  isLoadingRooms.value = true
  try {
    // Get Matrix client to get actual room information
    const matrixClient = matrixClientManager.getClient()
    if (!matrixClient) {
      logger.warn('No Matrix client available')
      return
    }

    // Get ALL Matrix rooms from client
    const matrixRooms = matrixClient.getRooms() || []

    if (matrixRooms.length === 0) {
      // No Matrix rooms found - user may not be in any rooms yet
      return
    }

    // Get user's OpenMeet groups and events for context (optional)
    let groups: GroupEntity[] = []
    let events: EventEntity[] = []

    try {
      const [groupsResponse, eventsResponse] = await Promise.all([
        groupsApi.getAllMe(), // User's joined groups
        eventsApi.getDashboardEvents() // User's events
      ])
      groups = groupsResponse.data
      events = eventsResponse.data
    } catch (apiError) {
      logger.warn('Could not load OpenMeet groups/events, will show Matrix rooms without context:', apiError)
    }

    // Create lookup maps for OpenMeet context
    const groupsByRoomId = new Map()
    const eventsByRoomId = new Map()

    groups.forEach(group => {
      if (group.roomId) groupsByRoomId.set(group.roomId, group)
    })

    events.forEach(event => {
      if (event.roomId) eventsByRoomId.set(event.roomId, event)
    })

    // Convert ALL Matrix rooms to chat format
    const allChats: Chat[] = []

    matrixRooms.forEach(matrixRoom => {
      const roomId = matrixRoom.roomId
      const lastMessage = getLastMessage(matrixRoom)
      const unreadCount = getUnreadCount(matrixRoom)
      const participants = getParticipants(matrixRoom)

      // Try to identify what type of room this is
      let roomName = matrixRoom.name || 'Unnamed Room'
      let roomType: 'group' | 'event' | 'direct' = 'direct' // Default
      let description: string | undefined
      let chatId: string

      // Check if it's a known OpenMeet group room
      const linkedGroup = groupsByRoomId.get(roomId)
      if (linkedGroup) {
        roomName = linkedGroup.name
        roomType = 'group'
        description = linkedGroup.description
        chatId = `group-${linkedGroup.slug}`
      } else {
        // Check if it's a known OpenMeet event room
        const linkedEvent = eventsByRoomId.get(roomId)
        if (linkedEvent) {
          roomName = linkedEvent.name
          roomType = 'event'
          description = linkedEvent.description
          chatId = `event-${linkedEvent.slug}`
        } else {
          // Check room alias to infer type
          const canonicalAlias = matrixRoom.getCanonicalAlias()
          const altAliases = matrixRoom.getAltAliases()
          const allAliases = [canonicalAlias, ...altAliases].filter(Boolean)

          // Look for OpenMeet room alias patterns
          const groupAlias = allAliases.find(alias => alias?.startsWith('#group-'))
          const eventAlias = allAliases.find(alias => alias?.startsWith('#event-'))

          if (groupAlias) {
            roomType = 'group'
            chatId = roomId
          } else if (eventAlias) {
            roomType = 'event'
            chatId = roomId
          } else {
            // Assume direct message if 2 members, otherwise generic room
            roomType = participants.length <= 2 ? 'direct' : 'group'
            chatId = roomId
          }
        }
      }

      allChats.push({
        id: chatId,
        name: roomName,
        type: roomType,
        matrixRoomId: roomId,
        lastMessage: lastMessage?.body || lastMessage?.msgtype || undefined,
        lastActivity: lastMessage ? new Date(lastMessage.origin_server_ts) : undefined,
        unreadCount,
        participants,
        isEncrypted: matrixRoom.hasEncryptionStateEvent(),
        description
      })
    })

    // Sort by last activity (most recent first), then by name
    realRooms.value = allChats.sort((a, b) => {
      // Sort by last activity (most recent first)
      if (!a.lastActivity && !b.lastActivity) return a.name.localeCompare(b.name)
      if (!a.lastActivity) return 1
      if (!b.lastActivity) return -1
      return b.lastActivity.getTime() - a.lastActivity.getTime()
    })
  } catch (error) {
    logger.error('Failed to load Matrix rooms:', error)
    // No fallback - real data only
  } finally {
    isLoadingRooms.value = false
  }
}

// Helper functions for Matrix room data extraction
const getLastMessage = (room: Room) => {
  const timeline = room.getLiveTimeline()
  const events = timeline.getEvents()

  // Find the last message event (ignore state events, reactions, etc.)
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i]
    if (event.getType() === 'm.room.message' && !event.isRedacted()) {
      return {
        body: event.getContent().body,
        msgtype: event.getContent().msgtype,
        origin_server_ts: event.getTs(),
        sender: event.getSender()
      }
    }
  }
  return null
}

const getUnreadCount = (room: Room): number => {
  // Get unread count from Matrix room
  const unreadCount = room.getUnreadNotificationCount()
  return unreadCount > 0 ? unreadCount : 0
}

const getParticipants = (room: Room) => {
  const members = room.getJoinedMembers()
  return members.map((member: RoomMember) => ({
    id: member.userId,
    name: member.name || member.userId,
    avatar: member.getAvatarUrl('', 32, 32, 'crop', false, false) || undefined
  }))
}

// Update a single chat item when its room receives updates
const updateChatFromRoom = (room: Room, event?: MatrixEvent) => {
  const roomId = room.roomId
  const existingChatIndex = realRooms.value.findIndex(chat => chat.matrixRoomId === roomId)

  if (existingChatIndex !== -1) {
    const existingChat = realRooms.value[existingChatIndex]

    // Update unread count
    const newUnreadCount = getUnreadCount(room)

    // Update last activity if there's a new message event
    let lastActivity = existingChat.lastActivity
    let lastMessage = existingChat.lastMessage

    if (event && event.getType() === 'm.room.message') {
      lastActivity = new Date(event.getTs())
      lastMessage = event.getContent().body || event.getContent().msgtype
    } else if (!event) {
      // If no specific event, get the latest message
      const latestMessage = getLastMessage(room)
      if (latestMessage) {
        lastActivity = new Date(latestMessage.origin_server_ts)
        lastMessage = latestMessage.body || latestMessage.msgtype
      }
    }

    // Update the chat item
    realRooms.value[existingChatIndex] = {
      ...existingChat,
      unreadCount: newUnreadCount,
      lastActivity,
      lastMessage
    }
  }
}

// Initialize Matrix and load chats on component mount
onMounted(async () => {
  try {
    // ChatListPanel mounted, checking Matrix connection

    // For the main chats page, we want to show available chats proactively

    // Try to restore from stored session (Element Web pattern)
    const matrixClient = await matrixClientManager.initializeClient()
    if (!matrixClient) {
      // No stored session - start authentication flow
      await matrixClientManager.startAuthenticationFlow()
      return // Will complete after redirect
    }
    isMatrixInitializing.value = false

    // Listen for Matrix events to keep chat list reactive
    if (matrixClient) {
      matrixClient.on(ClientEvent.Sync, (state: string) => {
        if (state === 'PREPARED') {
          // Always reload on PREPARED to ensure fresh data after page reload
          loadRealRooms()
        }
      })

      // Listen for new messages to update unread counts and last activity
      matrixClient.on(RoomEvent.Timeline, (event, room) => {
        if (event.getType() === 'm.room.message' && !event.isRedacted()) {
          if (room) updateChatFromRoom(room, event)
        }
      })

      // Listen for read receipts to update unread counts
      matrixClient.on(RoomEvent.Receipt, (_, room) => {
        if (room) updateChatFromRoom(room)
      })
    }

    await loadRealRooms()
  } catch (error) {
    logger.error('Failed to load chats:', error)
    isMatrixInitializing.value = false
    isLoadingRooms.value = false
  }
})

// Enhanced sorting function
const sortChats = (chats: Chat[]): Chat[] => {
  return [...chats].sort((a, b) => {
    switch (sortBy.value) {
      case 'name':
        return a.name.localeCompare(b.name)
      case 'unread': {
        // Unread first, then by recent activity
        const unreadDiff = (b.unreadCount || 0) - (a.unreadCount || 0)
        if (unreadDiff !== 0) return unreadDiff
        return (b.lastActivity?.getTime() || 0) - (a.lastActivity?.getTime() || 0)
      }
      case 'type': {
        // Sort by type, then by name
        const typeDiff = a.type.localeCompare(b.type)
        if (typeDiff !== 0) return typeDiff
        return a.name.localeCompare(b.name)
      }
      case 'activity':
      default:
        return (b.lastActivity?.getTime() || 0) - (a.lastActivity?.getTime() || 0)
    }
  })
}

// Get recent chats - real data only
const recentChats = computed(() => {
  const chats = realRooms.value.filter(chat =>
    chat.lastActivity &&
    (Date.now() - chat.lastActivity.getTime()) < 7 * 24 * 60 * 60 * 1000 // Last 7 days
  )
  return sortChats(chats)
})

// Get available chats - real data only
const availableChats = computed(() => {
  const chats = realRooms.value.filter(chat =>
    !chat.lastActivity ||
    (Date.now() - chat.lastActivity.getTime()) >= 7 * 24 * 60 * 60 * 1000
  )
  return sortChats(chats)
})

// Enhanced filtering with unread-only and better search
const filteredRecentChats = computed(() => {
  return recentChats.value.filter(chat => {
    // Search filter
    const matchesSearch = !searchTerm.value ||
      chat.name.toLowerCase().includes(searchTerm.value.toLowerCase()) ||
      (chat.lastMessage && chat.lastMessage.toLowerCase().includes(searchTerm.value.toLowerCase())) ||
      (chat.description && chat.description.toLowerCase().includes(searchTerm.value.toLowerCase())) ||
      chat.participants?.some(p => p.name.toLowerCase().includes(searchTerm.value.toLowerCase()))

    // Type filter
    const matchesFilter = chatFilter.value === 'all' || chat.type === chatFilter.value
    const matchesContext = props.contextType === 'all' || chat.type === props.contextType

    // Unread filter
    const matchesUnread = !showUnreadOnly.value || (chat.unreadCount && chat.unreadCount > 0)

    return matchesSearch && matchesFilter && matchesContext && matchesUnread
  })
})

const filteredAvailableChats = computed(() => {
  return availableChats.value.filter(chat => {
    // Search filter
    const matchesSearch = !searchTerm.value ||
      chat.name.toLowerCase().includes(searchTerm.value.toLowerCase()) ||
      (chat.description && chat.description.toLowerCase().includes(searchTerm.value.toLowerCase()))

    // Type filter
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
    case 'direct': return chat.isEncrypted ? 'sym_r_lock' : 'sym_r_person'
    case 'group': return 'sym_r_group'
    case 'event': return 'sym_r_event'
    default: return 'sym_r_chat'
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
    case 'direct': return 'sym_r_person'
    case 'group': return 'sym_r_group'
    case 'event': return 'sym_r_event'
    default: return 'sym_r_chat'
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
  try {
    if (chat.type === 'group') {
      // Extract group slug from chat ID (format: 'group-slug' or Matrix room ID)
      let groupSlug = ''
      if (chat.id.startsWith('group-')) {
        groupSlug = chat.id.replace('group-', '')
      } else if (chat.id.startsWith('!') || chat.id.startsWith('#')) {
        // For Matrix room IDs without OpenMeet context, we need the slug
        // Try to find it via the room alias or description
        logger.warn('Matrix room without OpenMeet context - may need manual join')
        // For now, emit selection anyway as Matrix client should handle it
        emit('select-chat', chat)
        return
      }

      if (groupSlug) {
        // Use Matrix client service to join the group chat room
        // Joining group chat room using Matrix client
        const result = await matrixClientManager.joinGroupChatRoom(groupSlug)

        // Force Matrix client to sync to pick up new invitation
        await matrixClientManager.forceSyncAfterInvitation('group', groupSlug)

        // Update the chat's Matrix room ID if different
        if (result.room?.roomId && result.room.roomId !== chat.matrixRoomId) {
          chat.matrixRoomId = result.room.roomId
        }
      }
    } else if (chat.type === 'event') {
      // Extract event slug from chat ID (format: 'event-slug')
      let eventSlug = ''
      if (chat.id.startsWith('event-')) {
        eventSlug = chat.id.replace('event-', '')
      }

      if (eventSlug) {
        // Use Matrix client service to join the event chat room
        // Joining event chat room using Matrix client
        const result = await matrixClientManager.joinEventChatRoom(eventSlug)

        // Force Matrix client to sync to pick up new invitation
        await matrixClientManager.forceSyncAfterInvitation('event', eventSlug)

        // Update the chat's Matrix room ID if different
        if (result.room?.roomId && result.room.roomId !== chat.matrixRoomId) {
          chat.matrixRoomId = result.room.roomId
        }
      }
    } else if (chat.type === 'direct') {
      // For direct messages, use Matrix client service to create/join DM room
      // Creating/joining direct message room

      // Extract user identifier from chat ID (format: 'matrix-direct-roomId' or 'direct-userSlug')
      let userIdentifier = ''
      if (chat.id.startsWith('direct-')) {
        userIdentifier = chat.id.replace('direct-', '')
      } else if (chat.id.startsWith('matrix-direct-')) {
        // For Matrix-discovered DMs, we might need to extract from participants
        if (chat.participants && chat.participants.length > 0) {
          // Find the other participant (not the current user)
          const otherParticipant = chat.participants.find(p => p.id !== 'current-user-id') // TODO: Get actual current user ID
          userIdentifier = otherParticipant?.id || ''
        }
      }

      if (userIdentifier) {
        // Use Matrix client service to create/join DM room
        // Convert user slug to Matrix user ID format if needed
        let matrixUserId = userIdentifier
        if (!matrixUserId.startsWith('@')) {
          // Assume it's a user slug, convert to Matrix user ID
          const getEnv = (await import('../../utils/env')).default
          const tenantId = getEnv('APP_TENANT_ID') || localStorage.getItem('tenantId')
          matrixUserId = `@${userIdentifier}-${tenantId}:matrix.openmeet.net`
        }

        const room = await matrixClientManager.joinDirectMessageRoom(matrixUserId)

        // Update the chat's Matrix room ID
        if (room.roomId !== chat.matrixRoomId) {
          chat.matrixRoomId = room.roomId
        }
      }
    }

    // Refresh the room list to get updated room information
    await loadRealRooms()

    // Select the chat for viewing
    emit('select-chat', chat)
  } catch (error) {
    logger.error('Failed to join chat:', error)
    // Still try to select it in case Matrix client can handle it directly
    emit('select-chat', chat)
  }
}

const startDirectMessage = () => {
  showNewChatDialog.value = true
  newChatType.value = 'direct'
}

const browseGroups = () => {
  router.push('/groups')
}

const refreshRooms = async () => {
  await loadRealRooms()
}

const markAllRead = async () => {
  try {
    const matrixClient = matrixClientManager.getClient()
    if (!matrixClient) return

    // Marking all rooms as read

    // Mark all rooms as read
    for (const chat of realRooms.value) {
      if (chat.unreadCount && chat.unreadCount > 0) {
        const room = matrixClient.getRoom(chat.matrixRoomId)
        if (room) {
          const timeline = room.getLiveTimeline()
          const events = timeline.getEvents()
          if (events.length > 0) {
            const lastEvent = events[events.length - 1]
            await matrixClient.sendReadReceipt(lastEvent)
          }
        }
      }
    }

    // Refresh the room list to update unread counts
    await loadRealRooms()
  } catch (error) {
    logger.error('Failed to mark all rooms as read:', error)
  }
}

const searchNewChat = async () => {
  if (!newChatSearch.value.trim()) return

  isSearching.value = true
  try {
    newChatResults.value = []

    if (newChatType.value === 'group') {
      // Search for groups using the search API
      const response = await searchApi.searchGroups({
        search: newChatSearch.value,
        page: 1,
        limit: 10
      })

      // Convert group entities to chat format
      newChatResults.value = response.data.map(group => ({
        id: `group-${group.slug}`,
        name: group.name,
        type: 'group' as const,
        matrixRoomId: group.roomId || '',
        description: group.description || `${group.membersCount || 0} members`,
        participants: []
      }))
    } else if (newChatType.value === 'event') {
      // Search for events using the search API
      const response = await searchApi.searchEvents({
        search: newChatSearch.value,
        page: 1,
        limit: 10
      })

      // Convert event entities to chat format
      newChatResults.value = response.data.map(event => ({
        id: `event-${event.slug}`,
        name: event.name,
        type: 'event' as const,
        matrixRoomId: event.roomId || '',
        description: event.description || new Date(event.startDate).toLocaleDateString(),
        participants: []
      }))
    } else if (newChatType.value === 'direct') {
      // Search for users for direct messages
      try {
        const response = await usersApi.search({
          search: newChatSearch.value,
          limit: 10
        })

        // Convert user entities to chat format
        newChatResults.value = response.data.map(user => ({
          id: `direct-${user.slug}`,
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.name || user.slug,
          type: 'direct' as const,
          matrixRoomId: '', // Will be created when chat is started
          description: `@${user.name || user.slug}`,
          participants: []
        }))
      } catch (error) {
        logger.error('User search failed - endpoint may not be implemented yet:', error)
        newChatResults.value = []
      }
    }
  } catch (error) {
    logger.error('Failed to search chats:', error)
    newChatResults.value = []
  } finally {
    isSearching.value = false
  }
}

const startNewChat = async (result: Chat) => {
  try {
    // Close the dialog
    showNewChatDialog.value = false
    newChatSearch.value = ''
    newChatResults.value = []

    // Join the chat using the same logic as joinChat
    // Starting new chat

    if (result.type === 'group' || result.type === 'event') {
      // Use the joinChat function we already implemented
      await joinChat(result)
    } else if (result.type === 'direct') {
      // For direct messages, we'll use the Matrix client service
      // Creating direct message room
      await joinChat(result)
    } else {
      // Fallback: just select the chat
      emit('select-chat', result)
    }
  } catch (error) {
    logger.error('Failed to start new chat:', error)
    // Still try to select it
    emit('select-chat', result)
  }
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

/* Card-based chat items */
.chat-item-card {
  transition: all 0.2s ease;
  cursor: pointer;
}

.chat-item-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.chat-item-card.selected-chat {
  border-color: var(--q-primary);
  background-color: rgba(25, 118, 210, 0.08);
}

.q-dark .chat-item-card:hover {
  box-shadow: 0 2px 8px rgba(255, 255, 255, 0.1);
}

.q-dark .chat-item-card.selected-chat {
  background-color: rgba(25, 118, 210, 0.15);
}

.available-chat-card {
  opacity: 0.9;
}

.available-chat-card:hover {
  opacity: 1;
}

/* Responsive card spacing */
@media (max-width: 599px) {
  .chat-item-card {
    margin-bottom: 6px;
  }
}

.empty-state {
  margin-top: 40px;
}

.chat-filters {
  margin-bottom: 8px;
}
</style>
