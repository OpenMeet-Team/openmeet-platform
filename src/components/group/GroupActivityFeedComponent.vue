<script setup lang="ts">
import { ref, onMounted } from 'vue'
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

async function fetchActivities () {
  isLoading.value = true
  error.value = null
  try {
    logger.debug(`Fetching activity feed for group: ${props.groupSlug}`)
    const response = await groupsApi.getFeed(props.groupSlug, { limit })
    logger.debug(`Activity feed response: ${response.data.length} items`)
    activities.value = response.data
    hasMore.value = response.data.length === limit
  } catch (err) {
    const axiosError = err as { response?: { status?: number; data?: { message?: string } }; code?: string; message?: string }
    logger.error('Failed to load activity feed', {
      group: props.groupSlug,
      status: axiosError.response?.status,
      code: axiosError.code,
      message: axiosError.response?.data?.message || axiosError.message,
      error: err
    })

    // Provide user-friendly error messages
    if (!axiosError.response) {
      // Network error - backend not reachable
      error.value = 'Unable to check activity. Please check your connection.'
    } else if (axiosError.response.status === 404) {
      // Group not found or endpoint not found
      error.value = 'Activity feed is currently unavailable'
    } else if (axiosError.response.status >= 500) {
      // Server error
      error.value = 'Unable to load activity. Please try again later.'
    } else {
      // Other errors (4xx)
      error.value = axiosError.response?.data?.message || 'Unable to load activity feed'
    }
  } finally {
    isLoading.value = false
  }
}

async function loadMore () {
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
  } catch (err) {
    logger.error('Failed to load more activities', {
      group: props.groupSlug,
      error: err
    })
  } finally {
    isLoadingMore.value = false
  }
}

function getActivityIcon (activityType: string): string {
  const icons: Record<string, string> = {
    'member.joined': 'sym_r_person_add',
    'event.created': 'sym_r_celebration',
    'event.rsvp': 'sym_r_check_circle',
    'group.activity': 'sym_r_pulse_alert'
  }
  return icons[activityType] || 'sym_r_notifications'
}

function getActivityColor (activityType: string): string {
  const colors: Record<string, string> = {
    'member.joined': 'primary',
    'event.created': 'secondary',
    'event.rsvp': 'positive',
    'group.activity': 'grey-6'
  }
  return colors[activityType] || 'grey-6'
}

function formatActivityText (activity: ActivityFeedEntity): {
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
      actorLink: metadata.actorSlug
    }
  }

  if (activityType === 'event.created') {
    return {
      text: `${metadata.actorName} created ${metadata.eventName}`,
      actorLink: metadata.actorSlug,
      eventLink: metadata.eventSlug
    }
  }

  if (activityType === 'event.rsvp') {
    if (aggregatedCount > 1) {
      return {
        text: `${aggregatedCount} people are attending ${metadata.eventName}`,
        eventLink: metadata.eventSlug
      }
    }
    return {
      text: `${metadata.actorName} is attending ${metadata.eventName}`,
      actorLink: metadata.actorSlug,
      eventLink: metadata.eventSlug
    }
  }

  if (activityType === 'group.activity') {
    return { text: 'Activity in this group' }
  }

  return { text: activity.activityType }
}

function navigateToEvent (activity: ActivityFeedEntity, event: Event) {
  event.stopPropagation()
  if (activity.metadata.eventSlug) {
    router.push({
      name: 'EventPage',
      params: {
        groupSlug: activity.metadata.groupSlug,
        slug: activity.metadata.eventSlug
      }
    })
  }
}

function navigateToActor (actorSlug: string, event: Event) {
  event.stopPropagation()
  router.push({
    name: 'MemberPage',
    params: { slug: actorSlug }
  })
}
</script>

<template>
  <div class="activity-feed-container">
    <SubtitleComponent class="q-px-md" label="Recent Activity" hide-link />

    <q-card flat>
      <q-card-section v-if="isLoading">
        <div class="text-center">
          <q-spinner color="primary" size="3em" />
        </div>
      </q-card-section>

      <q-card-section v-else-if="error" class="error-section">
        <div class="text-center">
          <q-icon name="sym_r_error_outline" size="48px" color="grey-6" class="q-mb-sm" />
          <div class="text-grey-7 q-mb-md">{{ error }}</div>
          <q-btn
            flat
            color="primary"
            @click="fetchActivities"
            class="retry-btn"
          >
            <q-icon name="sym_r_refresh" class="q-mr-sm" />
            Try again
          </q-btn>
        </div>
      </q-card-section>

      <q-list v-else-if="activities.length" class="activity-list" padding>
        <template v-for="(activity, index) in activities" :key="activity.ulid">
          <q-item class="activity-item">
            <q-item-section avatar>
              <q-icon
                :name="getActivityIcon(activity.activityType)"
                :color="getActivityColor(activity.activityType)"
                size="20px"
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
              </q-item-label>

              <q-item-label caption>
                {{ formatRelativeTime(activity.updatedAt) }}
              </q-item-label>
            </q-item-section>
          </q-item>

          <q-separator v-if="index < activities.length - 1" :key="`sep-${activity.ulid}`" />
        </template>

        <!-- Load More Button -->
        <q-card-section v-if="hasMore" class="text-center">
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
        </q-card-section>

        <q-card-section v-else-if="activities.length > 0" class="text-center">
          <div class="end-message">That's all the activity for this group</div>
        </q-card-section>
      </q-list>

      <q-card-section v-else>
        <NoContentComponent
          icon="sym_r_notifications_none"
          label="No recent activity"
        />
      </q-card-section>
    </q-card>
  </div>
</template>

<style scoped lang="scss">
.activity-feed-container {
  width: 100%;
}

.activity-list {
  padding: 0;
}

.activity-item {
  transition: background-color 0.2s ease;

  &:hover {
    background-color: rgba(0, 0, 0, 0.02);
  }
}

.actor-link,
.event-link {
  cursor: pointer;
  font-weight: 600;
  transition: opacity 0.15s ease;

  &:hover {
    opacity: 0.7;
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
}

.load-more-btn {
  font-weight: 500;
  text-transform: none;
}

.end-message {
  color: rgba(0, 0, 0, 0.38);
  font-size: 14px;
  font-style: italic;
}

.error-section {
  padding: 48px 24px;
}

.retry-btn {
  font-weight: 500;
  text-transform: none;
}

// Dark mode support
.body--dark {
  .activity-item {
    &:hover {
      background-color: rgba(255, 255, 255, 0.05);
    }
  }

  .end-message {
    color: rgba(255, 255, 255, 0.38);
  }
}
</style>
