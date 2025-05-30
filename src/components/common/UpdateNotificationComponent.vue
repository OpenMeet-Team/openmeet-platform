<template>
  <q-dialog
    v-model="showDialog"
    persistent
    transition-show="scale"
    transition-hide="scale"
  >
    <q-card class="q-pa-md" style="min-width: 400px">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">
          <q-icon name="sym_r_update" class="q-mr-sm text-primary" />
          New Version Available
        </div>
        <q-space />
      </q-card-section>

      <q-card-section>
        <div class="text-body1 q-mb-md">
          A new version of the application has been deployed.
        </div>

        <div class="text-caption text-grey-7 q-mb-md">
          <div>Current: {{ currentVersion.version }} ({{ currentVersion.commitSha.length > 8 ? currentVersion.commitSha.substring(0, 8) : currentVersion.commitSha }})</div>
          <div v-if="deployedVersion">New: {{ deployedVersion.version }} ({{ deployedVersion.commitSha.length > 8 ? deployedVersion.commitSha.substring(0, 8) : deployedVersion.commitSha }})</div>
        </div>

        <q-banner
          v-if="showWarning"
          class="text-warning bg-warning-light q-mb-md"
          rounded
        >
          <template v-slot:avatar>
            <q-icon name="sym_r_warning" />
          </template>
          <div class="text-body2">
            <strong>Important:</strong> If you continue without updating, some features may not work correctly.
            We strongly recommend updating now to avoid issues.
          </div>
        </q-banner>
      </q-card-section>

      <q-card-actions align="right" class="q-pt-none">
        <q-btn
          flat
          label="Continue Without Updating"
          color="grey-7"
          @click="handleContinueWithoutUpdate"
          :loading="isReloading"
        />
        <q-btn
          unelevated
          label="Update Now"
          color="primary"
          @click="handleUpdateNow"
          :loading="isReloading"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>

  <!-- Persistent update indicator when dismissed -->
  <q-btn
    v-if="showPersistentIndicator"
    fab-mini
    color="primary"
    icon="sym_r_update"
    class="fixed-bottom-right q-ma-md update-indicator"
    @click="showUpdateDialog"
    title="Update available - click to update"
  >
    <q-tooltip class="bg-primary">
      Update available
    </q-tooltip>
  </q-btn>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { versionService } from '../../services/versionService'

const showDialog = ref(false)
const showWarning = ref(false)
const isReloading = ref(false)

const currentVersion = computed(() => versionService.getCurrentVersion())
const deployedVersion = computed(() => versionService.getDeployedVersion())
const shouldShowUpdatePrompt = computed(() => versionService.shouldShowUpdatePrompt.value)
const isUpdateAvailable = computed(() => versionService.isUpdateAvailable.value)
const isUpdateDismissed = computed(() => versionService.isUpdateDismissed.value)

const showPersistentIndicator = computed(() =>
  isUpdateAvailable.value && isUpdateDismissed.value && !showDialog.value
)

const handleUpdateNow = () => {
  isReloading.value = true

  setTimeout(() => {
    versionService.forceReload()
  }, 500)
}

const handleContinueWithoutUpdate = () => {
  showWarning.value = true

  setTimeout(() => {
    versionService.dismissUpdatePrompt()
    showDialog.value = false
    showWarning.value = false
  }, 2000)
}

const showUpdateDialog = () => {
  showDialog.value = true
}

watch(shouldShowUpdatePrompt, (newValue) => {
  if (newValue && !showDialog.value) {
    showDialog.value = true
  }
}, { immediate: true })

onMounted(() => {
  if (shouldShowUpdatePrompt.value) {
    showDialog.value = true
  }
})
</script>

<style scoped>
.update-indicator {
  z-index: 2000;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(1);
  }
}

.bg-warning-light {
  background-color: rgba(255, 193, 7, 0.1) !important;
}
</style>
