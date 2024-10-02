export interface UploadedFile {
  path: string
  id: string
}

export interface Location {
  name: string
  address: string
  city?: string
  state?: string
  country?: string
  latitude?: number
  longitude?: number
}
