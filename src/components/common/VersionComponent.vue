<template>
  <div class="text-caption text-bold">
    Version: {{ version }} {{ commitHash }}
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
const version = ref('dev')
const commitHash = ref('local')

onMounted(async () => {
  try {
    const versionResponse = await fetch('/app-version.txt')
    const commitResponse = await fetch('/commit-sha.txt')

    if (versionResponse.ok && commitResponse.ok) {
      const versionText = await versionResponse.text()
      const commitText = await commitResponse.text()

      if (!versionText.match(/DOCTYPE/)) {
        version.value = versionText
        commitHash.value = commitText
      }
    }
  } catch (error) {
    console.error('Error loading version information:', error)
  }
})
</script>

<style scoped>
</style>
