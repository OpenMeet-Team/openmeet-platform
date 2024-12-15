<template>
  <div class="text-caption text-bold">
    Version: {{ version }} {{ commitHash }}
  </div>
</template>

<script setup>
import getEnv from 'src/utils/env'

const version = getEnv('APP_VERSION')
const commitHash = getEnv('COMMIT_SHA')
</script>

<style scoped>

</style>
