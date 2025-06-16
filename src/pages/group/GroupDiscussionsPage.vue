<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useGroupStore } from '../../stores/group-store'
import { useMessageStore } from '../../stores/unified-message-store'
import SubtitleComponent from '../../components/common/SubtitleComponent.vue'
import SpinnerComponent from '../../components/common/SpinnerComponent.vue'
import { GroupPermission } from '../../types'
import { useAuthStore } from '../../stores/auth-store'
import MessagesComponent from '../../components/messages/MessagesComponent.vue'
import NoContentComponent from '../../components/global/NoContentComponent.vue'
import { LoadingBar } from 'quasar'

const groupStore = useGroupStore()
const messageStore = useMessageStore()
const authStore = useAuthStore()

const group = computed(() => groupStore.group)
const hasPermission = computed(() => {
  return group.value && (
    groupStore.getterIsPublicGroup ||
    (groupStore.getterIsAuthenticatedGroup && authStore.isAuthenticated) ||
    groupStore.getterUserHasPermission(GroupPermission.SeeDiscussions)
  )
})

// Group discussion permissions
const canRead = computed(() => {
  return Boolean(
    groupStore.getterIsPublicGroup ||
    (groupStore.getterIsAuthenticatedGroup && authStore.isAuthenticated) ||
    groupStore.getterUserHasPermission(GroupPermission.SeeDiscussions)
  )
})

const canWrite = computed(() => {
  return Boolean(groupStore.getterUserHasPermission(GroupPermission.MessageDiscussion))
})

const canManage = computed(() => {
  return Boolean(groupStore.getterUserHasPermission(GroupPermission.ManageDiscussions))
})

const isLoading = ref(false)
const errorMessage = ref('')

// Initialize Matrix and load group discussions
const initializeGroupDiscussions = async () => {
  if (!group.value || !hasPermission.value) return

  isLoading.value = true
  LoadingBar.start()
  errorMessage.value = ''

  try {
    // Initialize Matrix connection for real-time updates if not already connected
    if (!messageStore.matrixConnected) {
      await messageStore.initializeMatrix()
    }

    // Group discussion data is now handled by the MessagesComponent via the chat API
    // Legacy discussions API calls have been removed
  } catch (err) {
    console.error('Error initializing group discussions:', err)
    errorMessage.value = 'Failed to load group discussions. Please try again.'
  } finally {
    isLoading.value = false
    LoadingBar.stop()
  }
}

onMounted(async () => {
  await initializeGroupDiscussions()
})

// Watch for group changes (eg. when navigating between groups)
watch(() => groupStore.group?.slug, async (newSlug, oldSlug) => {
  if (newSlug && newSlug !== oldSlug) {
    await initializeGroupDiscussions()
  }
})
</script>

<template>
  <SpinnerComponent v-if="isLoading" />

  <div v-else-if="errorMessage" class="text-center q-pa-lg">
    <q-icon name="sym_r_info" color="info" size="48px" />
    <div class="text-h6 q-mt-md">Group Discussions</div>
    <p v-if="errorMessage.includes('not implemented')">
      Group discussion functionality is coming soon!
    </p>
    <p v-else>{{ errorMessage }}</p>
    <q-btn v-if="!errorMessage.includes('not implemented')" color="primary" label="Retry" @click="initializeGroupDiscussions" />
  </div>

  <div data-cy="group-discussions-page" v-else-if="group && hasPermission" class="q-pb-xl">
    <SubtitleComponent class="q-mt-lg q-px-md" label="Discussions" :count="group?.topics?.length" hide-link />

    <!-- Discussions Section using unified MessagesComponent -->
    <MessagesComponent
      v-if="group && group.roomId"
      :room-id="group.roomId"
      context-type="group"
      :context-id="group.slug || ''"
      :context-entity="group"
      :can-read="canRead"
      :can-write="canWrite"
      :can-manage="canManage"
    />

    <!-- Fallback for missing roomId -->
    <div v-else-if="group && !group.roomId" class="text-center q-pa-lg">
      <q-icon name="sym_r_group" size="48px" color="grey-5" />
      <div class="text-h6 q-mt-md">Discussion Room Not Available</div>
      <p>There was an issue loading the discussion room. Please try again.</p>
      <q-btn color="primary" label="Retry" @click="initializeGroupDiscussions" />
    </div>
  </div>

  <NoContentComponent
    data-cy="no-permission-group-discussions-page"
    v-else-if="group && !hasPermission"
    label="You don't have permission to see this page"
    icon="sym_r_group"
  />
</template>

<style scoped lang="scss">
.full-height {
  height: calc(100vh - 350px);
  min-height: 400px;
}
</style>
