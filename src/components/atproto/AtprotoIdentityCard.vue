<template>
  <q-card class="atproto-identity-card" data-cy="atproto-identity-card">
    <q-card-section>
      <div class="text-h6 q-mb-md">
        <q-icon name="sym_r_cloud" class="q-mr-sm" />
        AT Protocol Identity
      </div>

      <!-- Loading state -->
      <div v-if="loading" class="flex flex-center q-pa-md" data-cy="identity-loading">
        <q-spinner color="primary" size="2em" />
      </div>

      <!-- No identity state -->
      <template v-else-if="!identity">
        <div class="q-mb-md">
          <q-banner class="bg-blue-1 text-dark" rounded>
            <template v-slot:avatar>
              <q-icon name="sym_r_info" color="primary" />
            </template>
            No AT Protocol identity linked to your account
          </q-banner>
        </div>
        <q-btn
          data-cy="create-identity-btn"
          color="primary"
          no-caps
          @click="$emit('create')"
        >
          <q-icon name="sym_r_add" class="q-mr-sm" />
          Create AT Protocol Identity
        </q-btn>
      </template>

      <!-- Identity exists -->
      <template v-else>
        <!-- External PDS warning -->
        <div v-if="!identity.isCustodial && !identity.isOurPds" class="q-mb-md">
          <q-banner class="bg-orange-1 text-dark" rounded>
            <template v-slot:avatar>
              <q-icon name="sym_r_info" color="warning" />
            </template>
            Your identity is hosted on an external PDS. Account changes must be made through your PDS provider.
          </q-banner>
        </div>

        <div class="q-gutter-y-md">
          <!-- Handle -->
          <div v-if="identity.handle" class="row items-center">
            <div class="text-subtitle2 text-grey-7 col-3">Handle</div>
            <div class="col text-body1 text-weight-medium">@{{ identity.handle }}</div>
          </div>

          <!-- DID -->
          <div class="row items-center">
            <div class="text-subtitle2 text-grey-7 col-3">DID</div>
            <div class="col row items-center no-wrap">
              <code class="text-body2 q-mr-sm">{{ truncatedDid }}</code>
              <q-btn
                data-cy="copy-did-btn"
                flat
                round
                dense
                size="sm"
                icon="sym_r_content_copy"
                @click="copyDid"
              >
                <q-tooltip>Copy full DID</q-tooltip>
              </q-btn>
            </div>
          </div>

          <!-- Status -->
          <div class="row items-center">
            <div class="text-subtitle2 text-grey-7 col-3">Status</div>
            <div class="col">
              <q-chip
                :color="statusColor"
                text-color="white"
                size="sm"
              >
                {{ statusText }}
              </q-chip>
            </div>
          </div>

          <!-- View on Bluesky link -->
          <div v-if="identity.handle" class="q-mt-md">
            <a
              data-cy="bluesky-profile-link"
              :href="blueskyProfileUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="text-primary"
            >
              View Profile on Bluesky
              <q-icon name="sym_r_open_in_new" size="xs" class="q-ml-xs" />
            </a>
          </div>
        </div>
      </template>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { copyToClipboard, Notify } from 'quasar'
import type { AtprotoIdentityDto } from '../../types/atproto'

const props = defineProps<{
  identity: AtprotoIdentityDto | null
  loading: boolean
}>()

// eslint-disable-next-line func-call-spacing
defineEmits<{
  (e: 'create'): void
}>()

const truncatedDid = computed(() => {
  if (!props.identity?.did) return ''
  const did = props.identity.did
  if (did.length <= 20) return did
  // Show first 12 chars and last 3 chars
  return `${did.slice(0, 12)}...${did.slice(-3)}`
})

const statusText = computed(() => {
  if (!props.identity) return ''
  if (props.identity.isCustodial) {
    return 'Managed by OpenMeet'
  }
  if (props.identity.isOurPds) {
    return 'Self-managed'
  }
  return 'Self-managed (external PDS)'
})

const statusColor = computed(() => {
  if (!props.identity) return 'grey'
  if (props.identity.isCustodial) return 'primary'
  if (props.identity.isOurPds) return 'positive'
  return 'orange'
})

const blueskyProfileUrl = computed(() => {
  if (!props.identity?.handle) return ''
  return `https://bsky.app/profile/${props.identity.handle}`
})

const copyDid = async () => {
  if (!props.identity?.did) return
  try {
    await copyToClipboard(props.identity.did)
    Notify.create({
      type: 'positive',
      message: 'DID copied to clipboard',
      position: 'top'
    })
  } catch (err) {
    console.error('Failed to copy DID:', err)
    Notify.create({
      type: 'negative',
      message: 'Failed to copy DID',
      position: 'top'
    })
  }
}
</script>

<style lang="scss" scoped>
.atproto-identity-card {
  code {
    background-color: rgba(0, 0, 0, 0.05);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: monospace;
    font-size: 0.9em;
  }
}
</style>
