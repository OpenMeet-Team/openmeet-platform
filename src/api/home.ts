import { AxiosResponse } from 'axios'
import { api } from 'boot/axios.ts'
import { CategoryEntity, EventEntity, GroupEntity } from 'src/types'

// Define the expected response type
interface HomeResponse {
  // Define the structure of the data you expect from the response
  groups: GroupEntity[]
  events: EventEntity[]
  categories: CategoryEntity[]
}

// Define the function that returns a typed AxiosResponse
export function apiHome (): Promise<AxiosResponse<HomeResponse>> {
  return api.get<HomeResponse>('/')
}
