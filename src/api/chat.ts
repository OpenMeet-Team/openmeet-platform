import { api } from 'boot/axios'

export const chatApi = {
  getChatList: () => api.get('/api/chat'),
  getChatByUserUlid: (userUlid: string) => api.get(`/api/chat/user/${userUlid}`),
  getChatByUlid: (ulid: string) => api.get(`/api/chat/${ulid}`),
  sendMessage: (ulid: string, message: string) => api.post(`/api/chat/${ulid}/message`, { content: message })
}
