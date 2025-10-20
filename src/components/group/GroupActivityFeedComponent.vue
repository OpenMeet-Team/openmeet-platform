<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { groupsApi } from '../../api/groups'
import { ActivityFeedEntity } from '../../types'
import { formatRelativeTime } from '../../utils/dateUtils'
import SubtitleComponent from '../common/SubtitleComponent.vue'
import NoContentComponent from '../global/NoContentComponent.vue'
import { useRouter } from 'vue-router'
import { logger } from '../../utils/logger'

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
    logger.debug(`Fetching activity feed for group: ${props.groupSlug}`)
    const response = await groupsApi.getFeed(props.groupSlug, { limit: 20 })
    logger.debug(`Activity feed response: ${response.data.length} items`)
    activities.value = response.data
  } catch (err: any) {
    logger.error('Failed to load activity feed', {
      group: props.groupSlug,
      status: err?.response?.status,
      message: err?.response?.data?.message,
      error: err
    })
    error.value = err?.response?.data?.message || 'Failed to load activity feed'
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

function formatActivityText(activity: ActivityFeedEntity): {
  text: string
  actorLink?: string
  eventLink?: string
} {
  const { activityType, aggregatedCount, metadata } = activity

  if (activityType === 'member.joined') {
    if (aggregatedCount > 1) {
      return { text: `${aggregatedCount} people joined the group` }
    }
    return {
      text: `${metadata.actorName} joined the group`,
      actorLink: metadata.actorSlug,
    }
  }

  if (activityType === 'event.created') {
    return {
      text: `${metadata.actorName} created ${metadata.eventName}`,
      actorLink: metadata.actorSlug,
      eventLink: metadata.eventSlug,
    }
  }

  if (activityType === 'event.rsvp') {
    if (aggregatedCount > 1) {
      return {
        text: `${aggregatedCount} people are attending ${metadata.eventName}`,
        eventLink: metadata.eventSlug,
      }
    }
    return {
      text: `${metadata.actorName} is attending ${metadata.eventName}`,
      actorLink: metadata.actorSlug,
      eventLink: metadata.eventSlug,
    }
  }

  if (activityType === 'group.activity') {
    return { text: 'Activity in this group' }
  }

  return { text: activity.activityType }
}

function navigateToEvent(activity: ActivityFeedEntity, event: Event) {
  event.stopPropagation()
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

function navigateToActor(actorSlug: string, event: Event) {
  event.stopPropagation()
  router.push({
    name: 'MemberPage',
    params: { slug: actorSlug },
  })
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
          class="shadow-1 q-mt-md activity-item"
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
              <template v-if="activity.activityType === 'member.joined' && activity.aggregatedCount === 1">
                <span
                  class="actor-link"
                  @click="navigateToActor(activity.metadata.actorSlug, $event)"
                >
                  {{ activity.metadata.actorName }}
                </span>
                <span> joined the group</span>
              </template>

              <template v-else-if="activity.activityType === 'member.joined' && activity.aggregatedCount > 1">
                <span>{{ activity.aggregatedCount }} people joined the group</span>
              </template>

              <template v-else-if="activity.activityType === 'event.created'">
                <span
                  class="actor-link"
                  @click="navigateToActor(activity.metadata.actorSlug, $event)"
                >
                  {{ activity.metadata.actorName }}
                </span>
                <span> created </span>
                <span
                  class="event-link"
                  @click="navigateToEvent(activity, $event)"
                >
                  {{ activity.metadata.eventName }}
                </span>
              </template>

              <template v-else-if="activity.activityType === 'event.rsvp' && activity.aggregatedCount === 1">
                <span
                  class="actor-link"
                  @click="navigateToActor(activity.metadata.actorSlug, $event)"
                >
                  {{ activity.metadata.actorName }}
                </span>
                <span> is attending </span>
                <span
                  class="event-link"
                  @click="navigateToEvent(activity, $event)"
                >
                  {{ activity.metadata.eventName }}
                </span>
              </template>

              <template v-else-if="activity.activityType === 'event.rsvp' && activity.aggregatedCount > 1">
                <span>{{ activity.aggregatedCount }} people are attending </span>
                <span
                  class="event-link"
                  @click="navigateToEvent(activity, $event)"
                >
                  {{ activity.metadata.eventName }}
                </span>
              </template>

              <template v-else>
                <span>{{ formatActivityText(activity).text }}</span>
              </template>
            </q-item-label>
            <q-item-label caption>
              {{ formatRelativeTime(activity.updatedAt) }}
            </q-item-label>
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
.activity-item {
  border-radius: 8px;
}

.actor-link,
.event-link {
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s ease;

  &:hover {
    text-decoration: underline;
  }
}

.actor-link {
  color: var(--q-primary);
}

.event-link {
  color: var(--q-secondary);
}
</style>
