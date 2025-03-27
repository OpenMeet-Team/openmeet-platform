import { UserEntity } from './user'
import { MatrixMessage } from './matrix'

export enum AuthProvidersEnum {
  apple = 'apple',
  bluesky = 'bluesky',
  email = 'email',
  facebook = 'facebook',
  github = 'github',
  google = 'google',
  twitter = 'twitter',
}

export enum SubCategoryType {
  EVENT = 'EVENT',
  GROUP = 'GROUP',
}

export interface ChatEntity {
  id: number;
  ulid: string;
  roomId: string;
  participants: UserEntity[];
  participant: UserEntity;
  user: UserEntity;
  messages: MatrixMessage[];
  unreadCount?: number;
}

export interface FileEntity {
  id: number
  path?: string
  fileSize?: number
  fileName?: string
  mimeType?: string
  shortId?: string
  resizes?: Record<string, string>
}

export interface AddressLocation {
  location?: string
  lat?: number
  lon?: number
}

export interface OSMAddress {
  house_number?: string;
  road?: string;
  suburb?: string;
  borough?: string;
  city?: string;
  municipality?: string;
  district?: string;
  state?: string;
  ISO3166_2_lvl4?: string;
  postcode?: string;
  country?: string;
  country_code?: string;
}

export interface OSMLocationSuggestion {
  place_id?: number;
  licence?: string;
  osm_type?: string;
  osm_id?: number;
  lat?: string;
  lon?: string;
  class?: string;
  type?: string;
  place_rank?: number;
  importance?: number;
  addresstype?: string;
  name?: string;
  display_name?: string;
  address?: OSMAddress;
  boundingbox?: string[];
}

export interface SubCategoryEntity {
  id: number,
  title: string,
  description?: string
  type: SubCategoryType
}

export interface CategoryEntity {
  id: number,
  slug?: string,
  name: string,
  subCategories: SubCategoryEntity[]
}

export interface OneTrustGeoLocationResponse {
  country: string
  state: string
  stateName: string
  continent: string
}

export interface Pagination<T> {
  data: T[]
  total: number
  page: number
  totalPages: number
}
