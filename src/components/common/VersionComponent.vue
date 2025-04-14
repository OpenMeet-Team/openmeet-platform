<template>
  <div class="text-caption text-bold">
    Version: {{ version }} {{ commitHash }}
  </div>
</template>

<script setup>
import { ref } from 'vue'

// Import version information from the file that's generated during the Docker build
// This approach ensures the version is "baked into" the image
import { APP_VERSION, COMMIT_SHA } from '../../version.js'

const version = ref(APP_VERSION)
const commitHash = ref(COMMIT_SHA)
</script>

<style scoped>
</style>
