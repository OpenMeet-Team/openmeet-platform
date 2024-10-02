import { defineStore } from 'pinia'

export const useDashboardStore = defineStore('dashboard', {
  state: () => ({
    events: null,
    event: null,
    groups: null,
    group: null
  }),

  getters: {},

  actions: {}
})
