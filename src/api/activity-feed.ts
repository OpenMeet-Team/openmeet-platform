import { api } from '../boot/axios'
import { ActivityFeedEntity } from '../types'
import { AxiosResponse } from 'axios'

export const activityFeedApi = {
  getSitewideFeed: (params?: { limit?: number, offset?: number }): Promise<AxiosResponse<ActivityFeedEntity[]>> =>
    api.get('/api/feed', { params })
}
