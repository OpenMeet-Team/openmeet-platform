<template>
    <div class="col-12">
        <q-banner rounded v-if="showDashboardWarning" class="bg-info text-white">
      <div class="text-body1"><q-icon size="sm" color="white" name="sym_r_warning" /> This platform is currently in beta. Data may be lost during updates.</div>
      <template v-slot:action>
        <q-btn flat dense label="Dismiss" @click="showDashboardWarning = false" />
      </template>
    </q-banner>
  </div>
</template>

<script>
export default {
  data () {
    return {
      showDashboardWarning: true
    }
  }
}
</script>
