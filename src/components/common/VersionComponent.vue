<template>
  <div class="text-caption text-bold">
    Version: {{ version }} {{ commitHash }}
  </div>
</template>

<script setup>
import getEnv from 'src/utils/env'

const version = getEnv('APP_VERSION') || 'alpha'
const commitHash = getEnv('COMMIT_SHA') || 'not set'
</script>

<style scoped>

</style>
