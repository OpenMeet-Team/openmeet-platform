<template>
  <div class="text-caption text-bold">
    Version: {{ version }} {{ commitHash }}
  </div>
</template>

<script setup>
const version = process.env.APP_VERSION
const commitHash = process.env.COMMIT_HASH
</script>

<style scoped>

</style>
