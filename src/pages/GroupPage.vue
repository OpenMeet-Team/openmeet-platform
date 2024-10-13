<template>
  <q-page v-if="group" class="q-pa-md">
    <div class="row q-col-gutter-md">
      <div class="col-12 col-md-6">
        <q-card>
          <q-img :src="getImageSrc(group.image)" :ratio="16/9"/>
        </q-card>
      </div>
      <div class="col-12 col-md-6">
        <q-card class="full-height">
          <q-card-section>
            <div class="text-h4">{{ group.name }}</div>
            <div class="text-subtitle2 row items-center">
              <q-icon size="xs" left name="sym_r_location_on"/>
              {{ group.location }}
            </div>
            <div class="q-mt-md">
              <q-badge class="q-mr-md" color="primary" v-if="group.membersCount"
                       :label="`${group.membersCount} members`"/>
              <q-badge color="secondary" label="Public group"/>
            </div>
            <div class="q-mt-md text-caption" v-if="group.user && group.user.name">Organized by {{
                group.user.name
              }}
            </div>
          </q-card-section>

          <q-card-section v-if="group.categories">
            <div class="text-h6">Categories</div>
            <div class="q-gutter-sm">
              <q-chip v-for="category in group.categories" :key="category.id">
                {{ category.name }}
              </q-chip>
            </div>
          </q-card-section>

          <q-card-section>
            <q-btn icon="sym_r_edit" size="md" padding="none" no-caps flat label="Edit group info" @click="$router.push({ name: 'DashboardGroupPage', params: {id: $route.params.id }})"/>
          </q-card-section>
          <q-space/>
          <q-card-section>
            <ShareComponent size="md"/>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <div class="row q-col-gutter-md q-mt-md">

      <div class="col-12 col-md-6 col-lg-4">
        <q-card>
          <q-card-section>
            <div class="text-body1 q-mt-md">{{ group.description }}</div>
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-md-6 col-lg-4">
        <!-- Events List Section -->
        <q-card>
          <q-card-section>
            <div class="text-h5">Upcoming Events</div>
          </q-card-section>
          <q-separator/>
          <q-list>
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
                <q-btn flat color="primary" label="Details" @click="viewEventDetails(event.id)"/>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card>
      </div>
      <div class="col-12 col-md-6 col-lg-4">
        <!-- Chat Section -->
        <q-card class="q-mt-md">
          <q-card-section>
            <div class="text-h5">Group Chat</div>
          </q-card-section>
          <q-separator/>
          <q-card-section class="chat-messages scroll" style="max-height: 300px">
            <div v-for="message in chatMessages" :key="message.id" class="q-mb-sm">
              <strong>{{ message.sender }}:</strong> {{ message.text }}
            </div>
          </q-card-section>
          <q-separator/>
          <q-card-section>
            <q-input
              v-model="newMessage"
              label="Type a message"
              dense
              @keyup.enter="sendMessage"
            >
              <template v-slot:after>
                <q-btn round dense flat icon="sym_r_send" @click="sendMessage"/>
              </template>
            </q-input>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-md-6 col-lg-4">
        <!-- Members List -->
        <q-card>
          <q-card-section>
            <div class="text-h5">Members</div>
          </q-card-section>
          <q-separator/>
          <q-list style="max-height: 300px" class="scroll">
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
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { date, LoadingBar } from 'quasar'
import { useRoute, useRouter } from 'vue-router'
// import { useUserStore } from 'stores/user-store.ts'
import { useGroupStore } from 'stores/group-store.ts'
import { getImageSrc } from 'src/utils/imageUtils.ts'
import ShareComponent from 'components/common/ShareComponent.vue'

interface ChatMessage {
  id: number;
  sender: string;
  text: string;
}

const chatMessages = ref<ChatMessage[]>([])
const newMessage = ref('')
const router = useRouter()
const route = useRoute()

const formatDate = (dateString: string) => {
  return date.formatDate(dateString, 'MMMM D, YYYY')
}

const viewEventDetails = (eventId: number) => {
  router.push({ name: 'EventPage', params: { id: eventId } })
}

const sendMessage = () => {
  if (newMessage.value.trim()) {
    chatMessages.value.push({
      id: Date.now(),
      sender: 'You', // In a real app, this would be the current user's name
      text: newMessage.value.trim()
    })
    newMessage.value = ''
    // In a real app, you'd send this message to a backend service
  }
}

const group = computed(() => {
  return useGroupStore().group
})

onMounted(async () => {
  LoadingBar.start()

  Promise.all([
    useGroupStore().actionGetGroupById(route.params.id as string)
    // useUserStore().actionGetGroupRights(route.params.id as string)
  ]).finally(LoadingBar.stop)

  // Mock chat messages
  chatMessages.value = [
    { id: 1, sender: 'John Doe', text: 'Welcome everyone to our group chat!' },
    { id: 2, sender: 'Jane Smith', text: 'Excited for the upcoming AI workshop!' },
    { id: 3, sender: 'Bob Johnson', text: 'Does anyone have resources on getting started with cybersecurity?' }
  ]
})
</script>

<style scoped>
.chat-messages {
  display: flex;
  flex-direction: column;
}

.chat-messages > div {
  max-width: 80%;
  padding: 8px 12px;
  border-radius: 12px;
  background-color: #f0f0f0;
  align-self: flex-start;
  margin-bottom: 8px;
}

.chat-messages > div:nth-child(even) {
  background-color: #e0e0e0;
  align-self: flex-end;
}
</style>
