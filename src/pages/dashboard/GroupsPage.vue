<template>
  <q-page class="q-pa-md">
    <div class="row items-center justify-between q-mb-lg">
      <h1 class="text-h4 q-my-none">My Groups</h1>
      <q-btn
        no-caps
        color="primary"
        icon="sym_r_add"
        label="Create Group"
        @click="onAddNewGroup"
      />
    </div>

    <div v-if="userGroups.length === 0" class="text-center q-pa-md">
      <q-icon name="sym_r_groups" size="4em" color="grey-5"/>
      <p class="text-h6 text-grey-6 q-mt-sm">You haven't joined any groups yet.</p>
      <q-btn color="primary" label="Explore Groups" @click="exploreGroups" class="q-mt-md"/>
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
            <q-chip
              :color="getRoleColor(group.userRole)"
              text-color="white"
              icon="sym_r_person"
            >
              {{ group.userRole }}
            </q-chip>
          </q-card-section>
          <q-separator/>
          <q-card-actions align="right">
            <q-btn flat color="primary" label="View Group" @click="viewGroup(group.id)"/>
            <q-btn flat color="primary" label="Edit Group" @click="editGroup(group.id)"/>
            <q-btn flat color="secondary" label="Leave Group" @click="confirmLeaveGroup(group)"/>
          </q-card-actions>
        </q-card>
      </div>
    </div>

    <q-dialog v-model="leaveGroupDialog" persistent>
      <q-card>
        <q-card-section class="row items-center">
          <q-avatar icon="sym_r_warning" color="warning" text-color="white"/>
          <span class="q-ml-sm">Are you sure you want to leave this group?</span>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="primary" v-close-popup/>
          <q-btn flat label="Leave Group" color="negative" @click="leaveGroup" v-close-popup/>
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { LoadingBar, useQuasar } from 'quasar'
import { useRouter } from 'vue-router'
import { apiGetDashboardGroups } from 'src/api/dashboard.ts'

const $q = useQuasar()

interface Group {
  id: string;
  name: string;
  category: string;
  imageUrl: string;
  userRole: 'Member' | 'Moderator' | 'Admin';
}

const userGroups = ref<Group[]>([])
const leaveGroupDialog = ref(false)
const groupToLeave = ref<Group | null>(null)
const router = useRouter()

const fetchUserGroups = async () => {
  userGroups.value = [
    {
      id: '1',
      name: 'Tech Enthusiasts',
      category: 'Technology',
      imageUrl: 'https://cdn.quasar.dev/img/mountains.jpg',
      userRole: 'Admin'
    },
    {
      id: '2',
      name: 'Outdoor Adventures',
      category: 'Sports & Fitness',
      imageUrl: 'https://cdn.quasar.dev/img/parallax1.jpg',
      userRole: 'Member'
    },
    {
      id: '3',
      name: 'Book Lovers Club',
      category: 'Arts & Culture',
      imageUrl: 'https://cdn.quasar.dev/img/parallax2.jpg',
      userRole: 'Moderator'
    },
    {
      id: '4',
      name: 'Test group',
      category: 'Arts & Culture',
      imageUrl: '',
      userRole: 'Moderator'
    }
  ]
}

onMounted(() => {
  LoadingBar.start()
  fetchUserGroups()
  apiGetDashboardGroups().then(() => {
    // TODO set groups
  }).finally(LoadingBar.stop)
})

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

const viewGroup = (groupId: string) => {
  router.push({ name: 'GroupPage', params: { id: groupId } })
}

const editGroup = (groupId: string) => {
  router.push({ name: 'DashboardGroup', params: { id: groupId } })
}

const exploreGroups = () => {
  router.push({ name: 'GroupsPage' })
}

const confirmLeaveGroup = (group: Group) => {
  groupToLeave.value = group
  leaveGroupDialog.value = true
}

const onAddNewGroup = () => {
  router.push({ name: 'DashboardGroupsCreate' })
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
