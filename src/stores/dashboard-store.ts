import { defineStore } from 'pinia'

export const useCounterStore = defineStore('counter', {
  state: () => ({
    events: null,
    event: null,
    groups: null,
    group: null
  }),

  getters: {},

  actions: {}
})
