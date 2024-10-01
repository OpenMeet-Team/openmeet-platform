import { AxiosResponse } from 'axios'
import { api } from 'boot/axios'

export function apiGetDashboardEvents (): Promise<AxiosResponse> {
  return api.get('/api/v1/dashboard/events')
}

export function apiGetDashboardGroups (): Promise<AxiosResponse> {
  return api.get('/api/v1/dashboard/groups')
}

export function apiGetDashboardMessages (): Promise<AxiosResponse> {
  return api.get('/api/v1/dashboard/messages')
}
