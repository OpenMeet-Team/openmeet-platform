<template>
  <div class="row items-center justify-between q-mb-xl">
    <div class="columns items-center">
      <q-btn
        v-if="backTo"
        flat
        no-caps
        padding="none"
        icon="sym_r_arrow_back"
        :to="backTo"
        label="Back"
        class="q-mr-md"
        color="primary"
      />
      <h1 class="text-h4 q-my-none" v-if="label">{{ label }}</h1>
    </div>
    <slot></slot>
  </div>

</template>

<script lang="ts" setup>
import { RouteLocationRaw } from 'vue-router'

interface Props {
  backTo?: RouteLocationRaw
  label?: string
}

defineProps<Props>()

</script>

<style scoped>
/* Add any specific styling here */
</style>
