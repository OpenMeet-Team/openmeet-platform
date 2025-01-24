import { defineStore } from 'pinia'
import { usersApi } from '../api'
import { UserEntity } from '../types'

export const useProfileStore = defineStore('profile', {
  state: () => ({
    user: null as UserEntity | null,
    isLoading: false
  }),

  actions: {
    actionGetMemberProfile (slug: string) {
      this.isLoading = true
      return usersApi.getMemberProfile(slug).then(user => {
        this.user = user.data
      }).finally(() => {
        this.isLoading = false
      })
    }
  }
})
