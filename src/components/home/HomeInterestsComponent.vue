<template>
  <div class="row">
    <div class="q-pa-md" v-for="interest in interests" :key="interest.name">
      <q-card flat bordered>
        <q-card-section>
          <h5 class="q-mb-none">{{ interest.name }}</h5>
                    <p>{{ interest.description }}</p>
        </q-card-section>
      </q-card>
    </div>
  </div>

</template>

<script lang="ts" setup>
interface Interest {
  name: string
  description: string
}

defineProps<{
  interests: Interest[];
}>()
</script>

<style scoped>
/* Add any custom styles here */
</style>
