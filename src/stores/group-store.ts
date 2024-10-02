import { defineStore } from 'pinia'
import { groupsApi } from 'src/api/groups.ts'
import { Group } from 'src/types'

export const useGroupStore = defineStore('group', {
  state: () => ({
    group: null as Group | null
  }),

  getters: {},

  actions: {
    actionGetGroupById (id: string) {
      groupsApi.getById(id).then(res => {
        this.group = res.data
      })
    }
  }
})
