<template>
  <q-btn
    size="md"
    dense
    :icon="isDark ? 'sym_r_light_mode' : 'sym_r_dark_mode'"
    @click="toggleDarkMode"
    flat
    round
  />
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar'
import { ref, watch } from 'vue'

const $q = useQuasar()
const isDark = ref($q.dark.isActive)

const toggleDarkMode = () => {
  $q.dark.toggle()
  isDark.value = $q.dark.isActive
  localStorage.setItem('darkMode', isDark.value.toString())
}

watch(() => $q.dark.isActive, (newValue) => {
  isDark.value = newValue
})
</script>
