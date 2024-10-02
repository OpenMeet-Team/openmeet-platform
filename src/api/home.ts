import { api } from 'boot/axios.ts'

export function apiHome () {
  return api.get('/')
}
