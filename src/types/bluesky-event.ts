export interface BlueskyEventValue {
  $type: string
  name: string
  description?: string
  createdAt: string
  startsAt: string
  endsAt?: string
  mode?: string
  status?: string
  locations?: Array<{
    type: string
    lat?: number
    lon?: number
    description?: string
    uri?: string
    name?: string
  }>
  uris?: Array<{
    uri: string
    name?: string
  }>
}

export interface BlueskyEvent {
  uri: string
  cid: string
  value: BlueskyEventValue
}
