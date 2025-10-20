<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { groupsApi } from '../../api/groups'
import { ActivityFeedEntity } from '../../types'
import { formatRelativeTime } from '../../utils/dateUtils'
import SubtitleComponent from '../common/SubtitleComponent.vue'
import NoContentComponent from '../global/NoContentComponent.vue'
import { useRouter } from 'vue-router'

interface Props {
  groupSlug: string
}

const props = defineProps<Props>()
const router = useRouter()

const activities = ref<ActivityFeedEntity[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)

onMounted(async () => {
  await fetchActivities()
})

async function fetchActivities() {
  isLoading.value = true
  error.value = null
  try {
    const response = await groupsApi.getFeed(props.groupSlug, { limit: 20 })
    activities.value = response.data
  } catch (err) {
    console.error('Failed to load activity feed:', err)
    error.value = 'Failed to load activity feed'
  } finally {
    isLoading.value = false
  }
}

function getActivityIcon(activityType: string): string {
  const icons: Record<string, string> = {
    'member.joined': 'sym_r_person_add',
    'event.created': 'sym_r_event',
    'event.rsvp': 'sym_r_check_circle',
    'group.activity': 'sym_r_pulse_alert',
  }
  return icons[activityType] || 'sym_r_notifications'
}

function getActivityColor(activityType: string): string {
  const colors: Record<string, string> = {
    'member.joined': 'primary',
    'event.created': 'secondary',
    'event.rsvp': 'positive',
    'group.activity': 'grey-6',
  }
  return colors[activityType] || 'grey-6'
}

function formatActivityText(activity: ActivityFeedEntity): string {
  const { activityType, aggregatedCount, metadata } = activity

  if (activityType === 'member.joined') {
    if (aggregatedCount > 1) {
      return `${aggregatedCount} people joined the group`
    }
    return `${metadata.actorName} joined the group`
  }

  if (activityType === 'event.created') {
    return `${metadata.actorName} created ${metadata.eventName}`
  }

  if (activityType === 'event.rsvp') {
    if (aggregatedCount > 1) {
      return `${aggregatedCount} people are attending ${metadata.eventName}`
    }
    return `${metadata.actorName} is attending ${metadata.eventName}`
  }

  if (activityType === 'group.activity') {
    return 'Activity in this group'
  }

  return activity.activityType
}

function navigateToActivity(activity: ActivityFeedEntity) {
  // Navigate to event if event activity
  if (activity.metadata.eventSlug) {
    router.push({
      name: 'EventPage',
      params: {
        groupSlug: activity.metadata.groupSlug,
        slug: activity.metadata.eventSlug,
      },
    })
  }
}

const clickableActivities = computed(() => {
  return activities.value.filter(a => a.metadata.eventSlug)
})

function isClickable(activity: ActivityFeedEntity): boolean {
  return !!activity.metadata.eventSlug
}
</script>

<template>
  <div>
    <SubtitleComponent class="q-px-md q-mt-lg" label="Recent Activity" />

    <q-card flat>
      <div v-if="isLoading" class="q-pa-md text-center">
        <q-spinner color="primary" size="3em" />
      </div>

      <div v-else-if="error" class="q-pa-md text-center text-negative">
        {{ error }}
      </div>

      <q-list v-else-if="activities.length">
        <q-item
          v-for="activity in activities"
          :key="activity.ulid"
          :clickable="isClickable(activity)"
          @click="isClickable(activity) ? navigateToActivity(activity) : undefined"
          class="shadow-1 q-mt-md"
        >
          <q-item-section avatar>
            <q-icon
              :name="getActivityIcon(activity.activityType)"
              :color="getActivityColor(activity.activityType)"
              size="md"
            />
          </q-item-section>
          <q-item-section>
            <q-item-label>
              {{ formatActivityText(activity) }}
            </q-item-label>
            <q-item-label caption>
              {{ formatRelativeTime(activity.updatedAt) }}
            </q-item-label>
          </q-item-section>
          <q-item-section v-if="isClickable(activity)" side>
            <q-icon name="sym_r_chevron_right" color="grey-6" />
          </q-item-section>
        </q-item>
      </q-list>

      <NoContentComponent
        v-else
        icon="sym_r_notifications_none"
        label="No recent activity"
      />
    </q-card>
  </div>
</template>

<style scoped lang="scss">
.q-item {
  border-radius: 8px;
  transition: all 0.2s ease;

  &[clickable="true"]:hover {
    background-color: rgba(0, 0, 0, 0.04);
    transform: translateX(4px);
  }
}
</style>
