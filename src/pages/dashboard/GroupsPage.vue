<template>
  <q-page class="q-pa-md">
    <h1 class="text-h4 q-mb-md">My Groups</h1>

    <div v-if="loading" class="text-center q-pa-md">
      <q-spinner color="primary" size="3em" />
      <p class="text-body1 q-mt-sm">Loading your groups...</p>
    </div>

    <div v-else-if="userGroups.length === 0" class="text-center q-pa-md">
      <q-icon name="groups" size="4em" color="grey-5" />
      <p class="text-h6 text-grey-6 q-mt-sm">You haven't joined any groups yet.</p>
      <q-btn color="primary" label="Explore Groups" @click="exploreGroups" class="q-mt-md" />
    </div>

    <div v-else class="row q-col-gutter-md">
      <div v-for="group in userGroups" :key="group.id" class="col-12 col-sm-6 col-md-4">
        <q-card class="group-card">
          <q-img :src="group.imageUrl" :ratio="16/9">
            <div class="absolute-bottom text-subtitle2 text-center bg-black-4 full-width">
              {{ group.name }}
            </div>
          </q-img>
          <q-card-section>
            <div class="text-h6">{{ group.name }}</div>
            <div class="text-subtitle2">{{ group.category }}</div>
          </q-card-section>
          <q-card-section class="q-pt-none">
            <div class="text-body2">{{ truncateDescription(group.description) }}</div>
          </q-card-section>
          <q-card-section class="q-pt-none">
            <q-chip
              :color="getRoleColor(group.userRole)"
              text-color="white"
              icon="person"
            >
              {{ group.userRole }}
            </q-chip>
          </q-card-section>
          <q-separator />
          <q-card-actions align="right">
            <q-btn flat color="primary" label="View Group" @click="viewGroup(group.id)" />
            <q-btn flat color="secondary" label="Leave Group" @click="confirmLeaveGroup(group)" />
          </q-card-actions>
        </q-card>
      </div>
    </div>

    <q-dialog v-model="leaveGroupDialog" persistent>
      <q-card>
        <q-card-section class="row items-center">
          <q-avatar icon="warning" color="warning" text-color="white" />
          <span class="q-ml-sm">Are you sure you want to leave this group?</span>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="primary" v-close-popup />
          <q-btn flat label="Leave Group" color="negative" @click="leaveGroup" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useQuasar } from 'quasar'

const $q = useQuasar()

interface Group {
  id: number;
  name: string;
  category: string;
  description: string;
  imageUrl: string;
  userRole: 'Member' | 'Moderator' | 'Admin';
}

const userGroups = ref<Group[]>([])
const loading = ref(true)
const leaveGroupDialog = ref(false)
const groupToLeave = ref<Group | null>(null)

const fetchUserGroups = async () => {
  // Simulating API call
  await new Promise(resolve => setTimeout(resolve, 1000))

  userGroups.value = [
    {
      id: 1,
      name: 'Tech Enthusiasts',
      category: 'Technology',
      description: 'A group for tech lovers to discuss the latest trends and innovations in technology.',
      imageUrl: 'https://cdn.quasar.dev/img/mountains.jpg',
      userRole: 'Admin'
    },
    {
      id: 2,
      name: 'Outdoor Adventures',
      category: 'Sports & Fitness',
      description: 'Join us for exciting hiking trips and outdoor adventures!',
      imageUrl: 'https://cdn.quasar.dev/img/parallax1.jpg',
      userRole: 'Member'
    },
    {
      id: 3,
      name: 'Book Lovers Club',
      category: 'Arts & Culture',
      description: 'Monthly meetups to discuss great books and share our love for literature.',
      imageUrl: 'https://cdn.quasar.dev/img/parallax2.jpg',
      userRole: 'Moderator'
    }
  ]

  loading.value = false
}

onMounted(fetchUserGroups)

const truncateDescription = (description: string, length: number = 100) => {
  return description.length > length
    ? description.substring(0, length) + '...'
    : description
}

const getRoleColor = (role: string) => {
  switch (role) {
    case 'Admin':
      return 'red'
    case 'Moderator':
      return 'orange'
    default:
      return 'green'
  }
}

const viewGroup = (groupId: number) => {
  console.log('View group:', groupId)
  // In a real app, you'd navigate to the group details page
}

const exploreGroups = () => {
  console.log('Explore groups')
  // In a real app, you'd navigate to the groups exploration page
}

const confirmLeaveGroup = (group: Group) => {
  groupToLeave.value = group
  leaveGroupDialog.value = true
}

const leaveGroup = () => {
  if (groupToLeave.value) {
    console.log('Leaving group:', groupToLeave.value.id)
    // In a real app, you'd make an API call to leave the group
    userGroups.value = userGroups.value.filter(g => g.id !== groupToLeave.value?.id)

    $q.notify({
      color: 'info',
      textColor: 'white',
      icon: 'info',
      message: `You have left the group: ${groupToLeave.value.name}`
    })

    groupToLeave.value = null
  }
}
</script>

<style scoped>
.group-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.group-card .q-card__section:nth-last-child(3) {
  flex-grow: 1;
}
</style>
