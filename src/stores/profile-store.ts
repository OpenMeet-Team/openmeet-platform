import { defineStore } from 'pinia'
import { usersApi } from '../api'
import { ProfileSummaryEntity } from '../types'

export const useProfileStore = defineStore('profile', {
  state: () => ({
    profile: null as ProfileSummaryEntity | null,
    isLoading: false
  }),

  actions: {
    async actionGetProfileSummary (slug: string) {
      this.isLoading = true
      try {
        const response = await usersApi.getProfileSummary(slug)
        this.profile = response.data
      } finally {
        this.isLoading = false
      }
    }
  }
})
