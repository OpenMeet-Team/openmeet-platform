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
const isLoadingMore = ref(false)
const error = ref<string | null>(null)
const hasMore = ref(true)
const limit = 20

onMounted(async () => {
  await fetchActivities()
})

async function fetchActivities() {
  isLoading.value = true
  error.value = null
  try {
    logger.debug(`Fetching activity feed for group: ${props.groupSlug}`)
    const response = await groupsApi.getFeed(props.groupSlug, { limit })
    logger.debug(`Activity feed response: ${response.data.length} items`)
    activities.value = response.data
    hasMore.value = response.data.length === limit
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

async function loadMore() {
  if (isLoadingMore.value || !hasMore.value) return

  isLoadingMore.value = true
  try {
    logger.debug(`Loading more activities, offset: ${activities.value.length}`)
    const response = await groupsApi.getFeed(props.groupSlug, {
      limit,
      offset: activities.value.length
    })
    logger.debug(`Loaded ${response.data.length} more activities`)

    if (response.data.length > 0) {
      activities.value.push(...response.data)
      hasMore.value = response.data.length === limit
    } else {
      hasMore.value = false
    }
  } catch (err: any) {
    logger.error('Failed to load more activities', {
      group: props.groupSlug,
      error: err
    })
  } finally {
    isLoadingMore.value = false
  }
}

function getActivityIcon(activityType: string): string {
  const icons: Record<string, string> = {
    'member.joined': 'sym_r_person_add',
    'event.created': 'sym_r_celebration',
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

function getActivityIconBg(activityType: string): string {
  const bgColors: Record<string, string> = {
    'member.joined': 'bg-primary-1',
    'event.created': 'bg-secondary-1',
    'event.rsvp': 'bg-positive-1',
    'group.activity': 'bg-grey-3',
  }
  return bgColors[activityType] || 'bg-grey-3'
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
  <div class="activity-feed-container">
    <SubtitleComponent class="q-px-md q-mt-lg" label="Recent Activity" />

    <div class="activity-feed-content q-px-md">
      <div v-if="isLoading" class="q-pa-md text-center">
        <q-spinner color="primary" size="3em" />
      </div>

      <div v-else-if="error" class="q-pa-md text-center text-negative">
        {{ error }}
      </div>

      <div v-else-if="activities.length" class="activity-list">
        <div
          v-for="activity in activities"
          :key="activity.ulid"
          class="activity-item"
        >
          <div :class="['activity-icon-container', getActivityIconBg(activity.activityType)]">
            <q-icon
              :name="getActivityIcon(activity.activityType)"
              :color="getActivityColor(activity.activityType)"
              size="24px"
            />
          </div>
          <div class="activity-content">
            <div class="activity-text">
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
                <span class="aggregated-count">{{ activity.aggregatedCount }} people</span>
                <span> joined the group</span>
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
                <span class="aggregated-count">{{ activity.aggregatedCount }} people</span>
                <span> are attending </span>
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
            </div>
            <div class="activity-time">
              {{ formatRelativeTime(activity.updatedAt) }}
            </div>
          </div>
        </div>

        <!-- Load More Button -->
        <div v-if="hasMore" class="load-more-container">
          <q-btn
            flat
            color="primary"
            :loading="isLoadingMore"
            @click="loadMore"
            class="load-more-btn"
          >
            <q-icon name="sym_r_expand_more" class="q-mr-sm" />
            Load more activity
          </q-btn>
        </div>

        <div v-else-if="activities.length > 0" class="end-message">
          That's all the activity for this group
        </div>
      </div>

      <NoContentComponent
        v-else
        icon="sym_r_notifications_none"
        label="No recent activity"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.activity-feed-container {
  width: 100%;
}

.activity-feed-content {
  margin-top: 1rem;
}

.activity-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.activity-item {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 16px;
  background: white;
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  transition: all 0.2s ease;

  &:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    transform: translateY(-1px);
  }
}

.activity-icon-container {
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s ease;
}

.activity-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.activity-text {
  font-size: 15px;
  line-height: 1.5;
  color: rgba(0, 0, 0, 0.87);
}

.activity-time {
  font-size: 13px;
  color: rgba(0, 0, 0, 0.54);
}

.actor-link,
.event-link {
  cursor: pointer;
  font-weight: 600;
  transition: all 0.15s ease;
  position: relative;

  &:hover {
    opacity: 0.8;
  }
}

.actor-link {
  color: var(--q-primary);
}

.event-link {
  color: var(--q-secondary);
}

.aggregated-count {
  font-weight: 600;
  color: rgba(0, 0, 0, 0.87);
}

.load-more-container {
  display: flex;
  justify-content: center;
  padding: 16px 0;
}

.load-more-btn {
  font-weight: 500;
  text-transform: none;
  font-size: 14px;
  padding: 8px 20px;

  &:hover {
    background: rgba(var(--q-primary-rgb), 0.08);
  }
}

.end-message {
  text-align: center;
  padding: 24px 0;
  color: rgba(0, 0, 0, 0.38);
  font-size: 14px;
  font-style: italic;
}

// Dark mode support (optional)
.body--dark {
  .activity-item {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.1);

    &:hover {
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      background: rgba(255, 255, 255, 0.08);
    }
  }

  .activity-text {
    color: rgba(255, 255, 255, 0.87);
  }

  .activity-time {
    color: rgba(255, 255, 255, 0.54);
  }

  .aggregated-count {
    color: rgba(255, 255, 255, 0.87);
  }

  .end-message {
    color: rgba(255, 255, 255, 0.38);
  }
}
</style>
