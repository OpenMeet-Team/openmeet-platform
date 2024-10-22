<script setup lang="ts">
import { RouteLocationRaw, useRouter } from 'vue-router'

interface Props {
  backTo?: RouteLocationRaw
  label?: string
  defaultBack?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  defaultBack: false
})

const router = useRouter()

const goBack = () => {
  if (props.backTo) {
    router.push(props.backTo)
  } else if (props.defaultBack) {
    router.back()
  }
}
</script>

<template>
  <div class="row items-center justify-between q-mb-xl">
    <div class="columns items-center row">
      <q-btn
        v-if="backTo || defaultBack"
        flat
        no-caps
        color="primary"
        icon="sym_r_arrow_back"
        label="Back"
        @click="goBack"
        class="q-mr-md"
      />
      <h4 class="text-h4 text-bold q-my-none" v-if="label">{{ label }}</h4>
    </div>
    <slot></slot>
  </div>
</template>

<style scoped>
/* Add any specific styling here */
</style>
