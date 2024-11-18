import { defineStore } from 'pinia'
import { discussionApi } from 'src/api'
import { ZulipTopicEntity, ZulipMessageEntity } from 'src/types'

export const useDiscussionStore = defineStore('discussion', {
  state: () => ({
    messages: [] as ZulipMessageEntity[],
    topics: [] as ZulipTopicEntity[],
    isLoading: false
  }),
  actions: {
    async actionFetchMessages (eventUlid: string) {
      this.isLoading = true
      const res = await discussionApi.getMessages(eventUlid)
      this.messages = res.data
      this.isLoading = false
    }
  }
})
