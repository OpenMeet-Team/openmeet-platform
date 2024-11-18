import { AxiosResponse } from 'axios'
import { api } from 'src/boot/axios'
import { ZulipMessageEntity } from 'src/types'

export const discussionApi = {
  getMessages: (eventUlid: string): Promise<AxiosResponse<ZulipMessageEntity[]>> => api.get(`/api/discussions/${eventUlid}/messages`)
}
