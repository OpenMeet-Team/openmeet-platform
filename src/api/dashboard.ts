import { AxiosResponse } from 'axios'
import { api } from 'boot/axios'
import { EventEntity, GroupEntity } from 'src/types'

export function apiGetDashboardEvents (): Promise<AxiosResponse<EventEntity[]>> {
  return api.get('/api/dashboard/my-events')
}

export function apiGetDashboardGroups (): Promise<AxiosResponse<GroupEntity[]>> {
  return api.get('/api/dashboard/my-groups')
}
