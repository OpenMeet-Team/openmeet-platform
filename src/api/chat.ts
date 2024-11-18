import { AxiosResponse } from 'axios'
import { api } from 'boot/axios'
import { ChatEntity } from 'src/types'
import { RouteQueryAndHash } from 'vue-router'

export const chatApi = {
  getChatList: (query: RouteQueryAndHash = {}): Promise<AxiosResponse<{ chats: ChatEntity[]; chat: ChatEntity | null }>> => api.get('/api/chat', { params: query }),
  sendMessage: (ulid: string, message: string) => api.post(`/api/chat/${ulid}/message`, { content: message }),
  setMessagesRead: (messageIds: number[]) => api.post('/api/chat/messages/read', { messages: messageIds })
}
