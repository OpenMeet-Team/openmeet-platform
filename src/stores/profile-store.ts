import { defineStore } from 'pinia'
import { usersApi } from 'src/api'
import { UserEntity } from 'src/types'

export const useProfileStore = defineStore('profile', {
  state: () => ({
    user: null as UserEntity | null,
    isLoading: false
  }),

  actions: {
    actionGetProfile (ulid: string) {
      this.isLoading = true
      return usersApi.getProfile(ulid).then(user => {
        this.user = user.data
      }).finally(() => {
        this.isLoading = false
      })
    }
  }
})
